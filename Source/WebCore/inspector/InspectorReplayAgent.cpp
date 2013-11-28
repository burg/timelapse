/*
 * Copyright (C) 2011-2013 University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of the University of Washington nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"
#include "InspectorReplayAgent.h"

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "DocumentLoader.h"
#include "Event.h"
#include "Frame.h"
#include "InspectorController.h"
#include "InspectorDebuggerAgent.h"
#include "InspectorFrontend.h"
#include "InspectorPageAgent.h"
#include "InspectorValues.h"
#include "InstrumentingAgents.h"
#include "JSONEncoderContext.h"
#include "Logging.h"
#include "Page.h"
#include "ReplayAgentStateMachine.h"
#include "ReplayController.h"
#include "ReplayRecording.h"
#include <wtf/RefCounted.h>
#include <wtf/text/AtomicString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

#ifndef NDEBUG
// For frameIndexFromDocument().
#include "EventLoopInput.h"
#endif

using namespace std;
using namespace WTF;

namespace WebCore {

InspectorReplayAgent::InspectorReplayAgent(InstrumentingAgents* instrumentingAgents, InspectorPageAgent* pageAgent)
    : InspectorBaseAgent(ASCIILiteral("Replay"), instrumentingAgents)
    , m_pageAgent(pageAgent)
    , m_page(nullptr)
    , m_nextMarkIndex(0)
    , m_lastHitMarkIndex(numeric_limits<unsigned>::max())
    , m_inputLocked(false)
{
}

InspectorReplayAgent::~InspectorReplayAgent()
{
    reset();
}

void InspectorReplayAgent::didCreateFrontendAndBackend(InspectorFrontendChannel* frontendChannel, InspectorBackendDispatcher* backendDispatcher)
{
    m_frontendDispatcher = std::make_unique<InspectorReplayFrontendDispatcher>(frontendChannel);
    m_backendDispatcher = InspectorReplayBackendDispatcher::create(backendDispatcher, this);

    // FIXME: set up frontend-specific state.
    m_instrumentingAgents->setInspectorReplayAgent(this);
    m_page = m_pageAgent->page();
}

void InspectorReplayAgent::willDestroyFrontendAndBackend()
{
    m_frontendDispatcher = nullptr;
    m_backendDispatcher.clear();

    // FIXME: clear frontend-specific state.
    m_instrumentingAgents->setInspectorReplayAgent(nullptr);
    reset();
}

void InspectorReplayAgent::reset()
{
    // FIXME: release resources, such as recording objects.
}

void InspectorReplayAgent::willDispatchEvent(const Event& event, Frame* frame)
{
    if (capturing() || replaying())
        m_page->replayController().willDispatchEvent(event, frame, reuseMark());
}

void InspectorReplayAgent::frameNavigated(DocumentLoader* loader)
{
    if (capturing() || replaying())
        m_page->replayController().frameNavigated(loader);
}

#ifndef NDEBUG
void InspectorReplayAgent::willCallFunction(const String& scriptName, int scriptLine, Frame* frame)
{
    if (!capturing() && !replaying())
        return;

    LOG(DeterministicReplay, "%-20s --->---> Function Call: %s:%d, target=%d/frame[%p]", " ",
    scriptName.utf8().data(), scriptLine, frameIndexFromDocument(frame->document()), (void*)frame);
}
#endif

void InspectorReplayAgent::recordingUnloaded()
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);

    if (m_frontendDispatcher) {
        m_frontendDispatcher->recordingUnloaded();
        m_frontendDispatcher->inputUnlocked();
    }
}

void InspectorReplayAgent::recordingLoaded(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    // In case we didn't know about the loaded recording, add here.
    m_recordingsMap.add(recording->uid(), recording);

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingLoaded);

    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingLoaded(recording->uid());
}

void InspectorReplayAgent::recordingCreated(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RecordingsMap::AddResult result = m_recordingsMap.add(recording->uid(), recording);
    // Can't have two recordings with same uid.
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingAdded(recording->uid());

    // Automatically load the created recording if nothing else is loaded.
    if (m_stateMachine.inState(ReplayAgentStateMachine::RecordingUnloaded))
        m_page->replayController().loadRecording(recording);
}

void InspectorReplayAgent::capturedEventLoopInput(EventLoopInput* input)
{
    // This instrumentation should only fire when we are actually capturing.
    // If it's some transient state, the caller should know not to call.
    ASSERT(capturing());

    PositionMark newMark = createMark();
    input->setMark(newMark);

    if (!m_frontendDispatcher)
        return;
    if (!input->isUserVisible())
        return;

    RefPtr<TypeBuilder::Replay::ReplayInput> serializedInput = JSONCoder::serializeInput(input, newMark.index());
    if (serializedInput)
        m_frontendDispatcher->capturedInput(serializedInput.release());
}

void InspectorReplayAgent::captureStarted()
{
    LOG(DeterministicReplay, "-----CAPTURE START-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Capturing);
    m_inputLocked = false;
    if (m_frontendDispatcher) {
        m_frontendDispatcher->captureStarted();
        m_frontendDispatcher->inputUnlocked();
    }
}

void InspectorReplayAgent::captureFinished()
{
    LOG(DeterministicReplay, "-----CAPTURE STOP-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);

    if (m_frontendDispatcher)
        m_frontendDispatcher->captureStopped();
}

void InspectorReplayAgent::playbackStarted()
{
    LOG(DeterministicReplay, "-----REPLAY START-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Replaying);
    m_inputLocked = true;
    if (m_frontendDispatcher) {
        m_frontendDispatcher->playbackStarted();
        m_frontendDispatcher->inputLocked();
    }
}

void InspectorReplayAgent::playbackPaused(PositionMarkIndex index)
{
    LOG(DeterministicReplay, "-----REPLAY PAUSED-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::ReplayPaused);
    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackPaused(index);
}

void InspectorReplayAgent::playbackHitMark(PositionMarkIndex index)
{
    if (m_lastHitMarkIndex == index)
        return;
    m_lastHitMarkIndex = index;

    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackHitMark(index);
}

void InspectorReplayAgent::playbackFinished()
{
    LOG(DeterministicReplay, "-----REPLAY STOP-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingLoaded);
    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackFinished();
}

void InspectorReplayAgent::playbackCancelled()
{
    m_inputLocked = false;

    if (m_frontendDispatcher)
        m_frontendDispatcher->inputUnlocked();
}

void InspectorReplayAgent::playbackError(bool isFatal, const String& errorString)
{
    // NB. if instead you would like to debug the failure,
    // this is a decent breakpoint location.
    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackError(isFatal, errorString);
}

void InspectorReplayAgent::imageCaptured(const String& imageDataUri)
{
    if (m_frontendDispatcher)
        m_frontendDispatcher->imageCaptured(imageDataUri);
}

PositionMark InspectorReplayAgent::createMark()
{
    return PositionMark(m_nextMarkIndex++);
}

PositionMark InspectorReplayAgent::reuseMark() const
{
    return PositionMark(m_nextMarkIndex);
}

void InspectorReplayAgent::stop()
{
    ErrorString dummy;
    bool dummy2;

    if (capturing())
        stopCapture(&dummy, &dummy2);
    else if (replaying())
        stopPlayback(&dummy, true);
}

void InspectorReplayAgent::isEnabled(ErrorString*, bool* result)
{
    *result = m_stateMachine.enabled();
}

void InspectorReplayAgent::enable(ErrorString*)
{
    if (m_stateMachine.enabled())
        return;

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);
    m_instrumentingAgents->setInspectorReplayAgent(this);

    if (m_frontendDispatcher)
        m_frontendDispatcher->replayEnabled();
}

void InspectorReplayAgent::disable(ErrorString*)
{
    if (m_stateMachine.disabled())
        return;

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Disabled);
    m_instrumentingAgents->setInspectorReplayAgent(0);

    if (m_frontendDispatcher)
        m_frontendDispatcher->replayDisabled();
}

void InspectorReplayAgent::startCapture(ErrorString*)
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForCapture);
    m_nextMarkIndex = 0;

    createMark();
    m_page->replayController().beginCapturing();
}

void InspectorReplayAgent::stopCapture(ErrorString*, bool* wasAllowed)
{
    createMark();
    *wasAllowed = m_page->replayController().endCapturing();
}

void InspectorReplayAgent::replayUpToMarkIndex(ErrorString*, int markIndex, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // Cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForReplay);
    m_page->replayController().replayUpToMarkIndex((unsigned)markIndex, (fastReplay) ? FullSpeed : Realtime);
}

void InspectorReplayAgent::replayToCompletion(ErrorString*, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // Cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForReplay);
    m_page->replayController().replayToCompletion((fastReplay) ? FullSpeed : Realtime);
}

void InspectorReplayAgent::pausePlayback(ErrorString*)
{
    // This will fire InspectorInstrumentation::playbackPaused, and our
    // listener for that will change state machine and tell frontend.
    m_page->replayController().pauseAtNextMark();
}

void InspectorReplayAgent::stopPlayback(ErrorString*, bool shouldUnlock)
{
    m_inputLocked = !shouldUnlock;
    m_page->replayController().cancelPlayback();
}

void InspectorReplayAgent::setPauseOnError(ErrorString*, bool shouldPause)
{
    m_page->replayController().setErrorStrategy(shouldPause ? PauseOnError : ContinueOnError);
}

void InspectorReplayAgent::loadRecording(ErrorString* errorString, int uid, bool* wasAllowed)
{
    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording) {
        *wasAllowed = false;
        return;
    }

    *wasAllowed = m_page->replayController().loadRecording(recording);
}

void InspectorReplayAgent::unloadRecording(ErrorString* errorString, bool* wasAllowed)
{
    if (!m_page->replayController().loadedRecording().get()) {
        *wasAllowed = false;
        *errorString = "Tried to unload but no recording is currently loaded.";
        return;
    }

    *wasAllowed = m_page->replayController().unloadRecording();
}

PassRefPtr<ReplayRecording> InspectorReplayAgent::findRecording(ErrorString* errorString, int uid)
{
    ASSERT(uid >= 0);

    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *errorString = "Couldn't find recording with specified uid";
        return nullptr;
    }

    return it->value;
}

void InspectorReplayAgent::getSerializedRecording(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Replay::ReplayRecording>& serializedObject)
{
    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording)
        return;

    serializedObject = JSONCoder::serialize(recording);
}

void InspectorReplayAgent::getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int> >& recordingsList)
{
    recordingsList = TypeBuilder::Array<int>::create();
    for (RecordingsMap::iterator it = m_recordingsMap.begin(); it != m_recordingsMap.end(); ++it) {
        recordingsList->addItem(it->key);
    }
}

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
