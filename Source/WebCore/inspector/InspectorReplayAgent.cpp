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
#include "InspectorPageAgent.h"
#include "InstrumentingAgents.h"
#include "JSONEncoderContext.h"
#include "Logging.h"
#include "Page.h"
#include "ReplayAgentStateMachine.h"
#include "ReplayController.h"
#include "ReplayRecording.h"
#include <inspector/InspectorValues.h>
#include <wtf/RefCounted.h>
#include <wtf/text/AtomicString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

#ifndef NDEBUG
// For frameIndexFromDocument().
#include "EventLoopInput.h"
#endif

using namespace Inspector;

namespace WebCore {

InspectorReplayAgent::InspectorReplayAgent(InstrumentingAgents* instrumentingAgents, InspectorPageAgent* pageAgent)
    : InspectorAgentBase(ASCIILiteral("Replay"), instrumentingAgents)
    , m_pageAgent(pageAgent)
    , m_page(nullptr)
    , m_nextMarkIndex(0)
    , m_lastHitMarkIndex(std::numeric_limits<unsigned>::max())
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

    // Keep track of the session the ReplayController has created/loaded.
    RefPtr<CaptureSession> session = m_page->replayController().loadedSession();
    m_sessionsMap.add(session->uid(), session);
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

void InspectorReplayAgent::sessionCreated(RefPtr<CaptureSession> session)
{
    SessionsMap::AddResult result = m_sessionsMap.add(session->uid(), session);
    // Can't have two sessions with same uid.
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontendDispatcher)
        m_frontendDispatcher->sessionCreated(session->uid());
}

void InspectorReplayAgent::sessionLoaded(RefPtr<CaptureSession> session)
{
    // In case we didn't know about the loaded session, add here.
    m_sessionsMap.add(session->uid(), session);

    if (m_frontendDispatcher)
        m_frontendDispatcher->sessionLoaded(session->uid());
}

void InspectorReplayAgent::recordingCreated(RefPtr<ReplayRecording> recording)
{
    RecordingsMap::AddResult result = m_recordingsMap.add(recording->uid(), recording);
    // Can't have two recordings with same uid.
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingCreated(recording->uid());
}

void InspectorReplayAgent::recordingClosed(RefPtr<ReplayRecording> recording)
{
    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingClosed(recording->uid());
}

void InspectorReplayAgent::recordingAddedToSession(RefPtr<CaptureSession> session, RefPtr<ReplayRecording> recording, RecordingIndex recordingIndex)
{
    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingAddedToSession(session->uid(), recording->uid(), recordingIndex);
}

void InspectorReplayAgent::recordingRemovedFromSession(RefPtr<CaptureSession> session, RecordingIndex recordingIndex)
{
    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingRemovedFromSession(session->uid(), recordingIndex);
}

void InspectorReplayAgent::recordingLoaded(RefPtr<ReplayRecording> recording)
{
    // In case we didn't know about the loaded recording, add here.
    m_recordingsMap.add(recording->uid(), recording);

    if (m_frontendDispatcher)
        m_frontendDispatcher->recordingLoaded(recording->uid());
}

void InspectorReplayAgent::recordingUnloaded()
{
    if (m_frontendDispatcher) {
        m_frontendDispatcher->recordingUnloaded();
        m_frontendDispatcher->inputUnlocked();
    }
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

    RefPtr<Inspector::TypeBuilder::Replay::ReplayInput> serializedInput = JSONCoder::serializeInput(input, newMark.index());
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

    m_stateMachine.advanceTo(ReplayAgentStateMachine::ReadyForCaptureOrReplay);

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

void InspectorReplayAgent::playbackPaused(RecordingIndex recordingIndex, PositionMarkIndex index)
{
    LOG(DeterministicReplay, "-----REPLAY PAUSED-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::ReplayPaused);
    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackPaused(recordingIndex, index);
}

void InspectorReplayAgent::playbackHitLocation(RecordingIndex recordingIndex, PositionMarkIndex index)
{
    if (m_lastHitMarkIndex == index)
        return;
    m_lastHitMarkIndex = index;

    if (m_frontendDispatcher)
        m_frontendDispatcher->playbackHitLocation(recordingIndex, index);
}

void InspectorReplayAgent::playbackFinished()
{
    LOG(DeterministicReplay, "-----REPLAY STOP-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::ReadyForCaptureOrReplay);
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

void InspectorReplayAgent::replayUpToLocation(ErrorString*, int recordingIndex, int markIndex, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // Cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForReplay);
    m_page->replayController().replayUpToLocation((size_t)recordingIndex, (unsigned)markIndex, (fastReplay) ? FullSpeed : Realtime);
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

void InspectorReplayAgent::loadSession(ErrorString* errorString, int uid, bool* wasAllowed)
{
    ASSERT(m_stateMachine.canReplay());

    RefPtr<CaptureSession> session = findSession(errorString, uid);
    if (!session) {
        *wasAllowed = false;
        return;
    }

    *wasAllowed = m_page->replayController().loadSession(session);
}

void InspectorReplayAgent::addRecordingToSession(ErrorString* errorString, int sessionId, int recordingId, int recordingIndex, bool* wasAllowed)
{
    ASSERT(m_stateMachine.canReplay());
    ASSERT(recordingIndex >= 0);

    RefPtr<CaptureSession> session = findSession(errorString, sessionId);
    RefPtr<ReplayRecording> recording = findRecording(errorString, recordingId);

    if (!session || !recording || static_cast<size_t>(recordingIndex) > session->size()) {
        *wasAllowed = false;
        return;
    }

    *wasAllowed = true;
    session->insert(recordingIndex, recording);
    recordingAddedToSession(session, recording, recordingIndex);
}

void InspectorReplayAgent::removeRecordingFromSession(ErrorString* errorString, int sessionId, int recordingIndex, bool* wasAllowed)
{
    ASSERT(m_stateMachine.canReplay());
    ASSERT(recordingIndex >= 0);

    RefPtr<CaptureSession> session = findSession(errorString, sessionId);

    if (!session || static_cast<size_t>(recordingIndex) >= session->size()) {
        *wasAllowed = false;
        return;
    }

    *wasAllowed = true;
    session->remove(recordingIndex);
    recordingRemovedFromSession(session, recordingIndex);
}

RefPtr<CaptureSession> InspectorReplayAgent::findSession(ErrorString* errorString, int uid)
{
    ASSERT(uid >= 0);

    SessionsMap::iterator it = m_sessionsMap.find(uid);
    if (it == m_sessionsMap.end()) {
        *errorString = "Couldn't find session with specified uid";
        return nullptr;
    }

    return it->value;
}

RefPtr<ReplayRecording> InspectorReplayAgent::findRecording(ErrorString* errorString, int uid)
{
    ASSERT(uid >= 0);

    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *errorString = "Couldn't find recording with specified uid";
        return nullptr;
    }

    return it->value;
}

void InspectorReplayAgent::getSerializedSession(ErrorString* errorString, int uid, RefPtr<Inspector::TypeBuilder::Replay::CaptureSession>& serializedObject)
{
    RefPtr<CaptureSession> session = findSession(errorString, uid);
    if (!session)
        return;

    serializedObject = JSONCoder::serializeSession(session);
}

void InspectorReplayAgent::getAvailableSessions(ErrorString*, RefPtr<Inspector::TypeBuilder::Array<int> >& sessionsList)
{
    sessionsList = TypeBuilder::Array<int>::create();
    for (SessionsMap::iterator it = m_sessionsMap.begin(); it != m_sessionsMap.end(); ++it) {
        sessionsList->addItem(it->key);
    }
}

void InspectorReplayAgent::getSerializedRecording(ErrorString* errorString, int uid, RefPtr<Inspector::TypeBuilder::Replay::ReplayRecording>& serializedObject)
{
    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording)
        return;

    serializedObject = JSONCoder::serialize(recording);
}

void InspectorReplayAgent::getAvailableRecordings(ErrorString*, RefPtr<Inspector::TypeBuilder::Array<int> >& recordingsList)
{
    recordingsList = TypeBuilder::Array<int>::create();
    for (RecordingsMap::iterator it = m_recordingsMap.begin(); it != m_recordingsMap.end(); ++it) {
        recordingsList->addItem(it->key);
    }
}

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
