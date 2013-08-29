/*
 *  Copyright (C) 2011-2013, Brian Burg.
 *  Copyright (C) 2011-2013, University of Washington. All rights reserved.
 *
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

// For SerializedEventTarget::frameIndexFromDocument().
#include "DispatchEventBase.h"
#include "DocumentLoader.h"
#include "DOMWindow.h"
#include "Element.h"
#include "Event.h"
#include "EventContext.h"
#include "Frame.h"
#include "InspectorController.h"
#include "InspectorDebuggerAgent.h"
#include "InspectorFrontend.h"
#include "InspectorRecordingsAgent.h"
#include "InspectorState.h"
#include "InspectorValues.h"
#include "InstrumentingAgents.h"
#include "JSDOMGlobalObject.h"
#include "JSONInputEncoder.h"
#include "Logging.h"
#include "Node.h"
#include "Page.h"
#include "ReplayAgentStateMachine.h"
#include "ReplayController.h"
#include "ReplayRecording.h"
#include <wtf/OwnPtr.h>
#include <wtf/RefCounted.h>
#include <wtf/Vector.h>
#include <wtf/text/AtomicString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

using namespace std;
using namespace WTF;

namespace WebCore {

namespace ReplayPersistentAgentState {
static const char replayEnabled[] = "replayEnabled";
}

InspectorReplayAgent::InspectorReplayAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage)
: InspectorBaseAgent<InspectorReplayAgent>("Replay", instrumentingAgents, state)
, m_instrumentingAgents(instrumentingAgents)
, m_inspectedPage(inspectedPage)
, m_nextMarkIndex(0)
, m_lastHitMarkIndex(numeric_limits<unsigned>::max())
, m_inputLocked(false) {}

InspectorReplayAgent::~InspectorReplayAgent()
{
    // if destroying replayAgent, then stop instrumenting for marks (if we are)
    m_instrumentingAgents->setInspectorReplayAgent(0);
    m_instrumentingAgents = 0;
    m_state = 0;
    m_inspectedPage = 0;
}

void InspectorReplayAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->replay();
    if (m_state->getBoolean(ReplayPersistentAgentState::replayEnabled)) {
        ErrorString error;
        enable(&error);
    }
}

void InspectorReplayAgent::clearFrontend()
{
    //TODO: stop instrumenting, stop capturing, etc. see InspectorTimelineAgent::clearFrontend
    m_frontend = 0;
}

void InspectorReplayAgent::willDispatchEvent(const Event& event, DOMWindow* window, Node* node)
{
    if (capturing() || replaying())
        m_inspectedPage->replayController()->willDispatchEvent(event, window, node, reuseMark());
}

void InspectorReplayAgent::didDispatchEvent()
{
    if (capturing() || replaying())
        m_inspectedPage->replayController()->didDispatchEvent();
}

void InspectorReplayAgent::willDispatchEventOnWindow(const Event& event, DOMWindow* window)
{
    if (capturing() || replaying())
        m_inspectedPage->replayController()->willDispatchEvent(event, window, 0, reuseMark());
}

void InspectorReplayAgent::didDispatchEventOnWindow()
{
    didDispatchEvent();
}

void InspectorReplayAgent::frameNavigated(DocumentLoader* loader)
{
    if (capturing() || replaying())
        m_inspectedPage->replayController()->frameNavigated(loader);
}

void InspectorReplayAgent::willFireTimer(int timerId, Frame* frame)
{
    if (capturing() || replaying())
        m_inspectedPage->replayController()->willFireTimer(timerId, frame->document());
}

void InspectorReplayAgent::willCallFunction(const String& scriptName, int scriptLine, Frame* frame)
{
#ifndef NDEBUG
    LOG(DeterministicReplay, "%-20s --->---> Function Call: %s:%d, target=%d/frame[%p]", " ",
    scriptName.utf8().data(), scriptLine, 
    SerializedEventTarget::frameIndexFromDocument(frame->document()), (void*)frame);   
#else
    UNUSED_PARAM(scriptName);
    UNUSED_PARAM(scriptLine);
    UNUSED_PARAM(frame);
#endif
}

void InspectorReplayAgent::recordingUnloaded()
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);

    if (m_frontend)
        m_frontend->recordingUnloaded();
}

void InspectorReplayAgent::recordingLoaded(PassRefPtr<ReplayRecording> prpRecording)
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingLoaded);

    if (m_frontend)
        m_frontend->recordingLoaded(prpRecording->uid());
}

void InspectorReplayAgent::recordingCreated(PassRefPtr<ReplayRecording> prpRecording)
{
    // automatically load the created recording if nothing else is loaded.
    if (m_stateMachine.inState(ReplayAgentStateMachine::RecordingUnloaded)) {
        m_inspectedPage->replayController()->loadRecording(prpRecording);
    }
}

void InspectorReplayAgent::capturedEventLoopInput(EventLoopInput* input)
{
    // this instrumentation should only fire when we are actually capturing.
    // if it's some transient state, the caller should know not to call.
    ASSERT(capturing());

    PositionMark newMark = createMark();
    input->setMark(newMark);

    if (!m_frontend)
        return;
    if (!input->isUserVisible())
        return;

    // TODO(Issue #271): remove backend-side interpretation of inputs
    m_frontend->capturedAction(InspectorRecordingsAgent::createInspectorObjectForAction(*input));

    DEFINE_STATIC_LOCAL(JSONInputEncoder, encoder, ());
    RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = encoder.serializeInput(input, newMark.index());
    if (serializedInput)
        m_frontend->capturedInput(serializedInput.release());
}

void InspectorReplayAgent::captureStarted()
{
    LOG(DeterministicReplay, "-----CAPTURE START-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Capturing);
    m_inputLocked = false;
    if (m_frontend) {
        m_frontend->captureStarted();
        m_frontend->inputUnlocked();
    }

}

void InspectorReplayAgent::captureFinished()
{
    LOG(DeterministicReplay, "-----CAPTURE STOP-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);

    if (m_frontend)
        m_frontend->captureStopped();
}

void InspectorReplayAgent::playbackStarted()
{
    LOG(DeterministicReplay, "-----REPLAY START-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Replaying);
    m_inputLocked = true;
    if (m_frontend) {
        m_frontend->playbackStarted();
        m_frontend->inputLocked();
    }
}

void InspectorReplayAgent::playbackPaused(PositionMarkIndex index)
{
    LOG(DeterministicReplay, "-----REPLAY PAUSED-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::ReplayPaused);
    if (m_frontend)
        m_frontend->playbackPaused(index);
}

void InspectorReplayAgent::playbackHitMark(PositionMarkIndex index)
{
    if (m_lastHitMarkIndex == index)
        return;
    m_lastHitMarkIndex = index;

    if (m_frontend)
        m_frontend->playbackHitMark(index);
}

void InspectorReplayAgent::playbackFinished()
{
    LOG(DeterministicReplay, "-----REPLAY STOP-----");

    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingLoaded);
    if (m_frontend)
        m_frontend->playbackFinished();
}

void InspectorReplayAgent::playbackCancelled()
{
    m_inputLocked = false;

    if (m_frontend)
        m_frontend->inputUnlocked();
}

void InspectorReplayAgent::playbackError(bool isFatal, const String& errorString)
{
    // NB. if instead you would like to debug the failure,
    // this is a decent breakpoint location.
    if (m_frontend)
        m_frontend->playbackError(isFatal, errorString);
}

void InspectorReplayAgent::imageCaptured(const String& imageDataUri)
{
    if (m_frontend)
        m_frontend->imageCaptured(imageDataUri);
}

PositionMark InspectorReplayAgent::createMark()
{
    return  PositionMark(m_nextMarkIndex++);
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
    m_state->setBoolean(ReplayPersistentAgentState::replayEnabled, true);
    m_instrumentingAgents->setInspectorReplayAgent(this);

    if (m_frontend)
        m_frontend->replayEnabled();
}

void InspectorReplayAgent::disable(ErrorString*)
{
    if (m_stateMachine.disabled())
        return;

    m_stateMachine.advanceTo(ReplayAgentStateMachine::Disabled);
    m_state->setBoolean(ReplayPersistentAgentState::replayEnabled, false);
    m_instrumentingAgents->setInspectorReplayAgent(0);

    if (m_frontend)
        m_frontend->replayDisabled();
}

void InspectorReplayAgent::startCapture(ErrorString*)
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForCapture);
    m_nextMarkIndex = 0;

    createMark();
    m_inspectedPage->replayController()->beginCapturing();
}

void InspectorReplayAgent::stopCapture(ErrorString*, bool* wasAllowed)
{
    createMark();
    *wasAllowed = m_inspectedPage->replayController()->endCapturing();
}

void InspectorReplayAgent::replayUpToMarkIndex(ErrorString*, int markIndex, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForReplay);
    m_inspectedPage->replayController()->replayUpToMarkIndex((unsigned)markIndex, (fastReplay) ? FullSpeed : Realtime);
}

void InspectorReplayAgent::replayToCompletion(ErrorString*, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(ReplayAgentStateMachine::WaitingForReplay);
    m_inspectedPage->replayController()->replayToCompletion((fastReplay) ? FullSpeed : Realtime);
}

void InspectorReplayAgent::pausePlayback(ErrorString*)
{
    // this will fire InspectorInstrumentation::playbackPaused, and our
    // listener for that will change state machine and tell frontend.
    m_inspectedPage->replayController()->pauseAtNextMark();
}

void InspectorReplayAgent::stopPlayback(ErrorString*, bool shouldUnlock)
{
    m_inputLocked = !shouldUnlock;
    m_inspectedPage->replayController()->cancelPlayback();
}

void InspectorReplayAgent::setPauseOnError(ErrorString*, bool shouldPause)
{
    m_inspectedPage->replayController()->setErrorStrategy(shouldPause ? PauseOnError : ContinueOnError);
}

void InspectorReplayAgent::loadRecording(ErrorString* errorString, int uid, bool* wasAllowed)
{
    InspectorRecordingsAgent* recordingsAgent = m_instrumentingAgents->inspectorRecordingsAgent();
    RefPtr<ReplayRecording> recording = recordingsAgent->findRecording(errorString, uid);
    if (!recording) {
        *wasAllowed = false;
        return;
    }

    *wasAllowed = m_inspectedPage->replayController()->loadRecording(recording);
}

void InspectorReplayAgent::unloadRecording(ErrorString* errorString, bool* wasAllowed)
{
    if (!m_inspectedPage->replayController()->loadedRecording().get()) {
        *wasAllowed = false;
        *errorString = "Tried to unload but no recording is currently loaded.";
        return;
    }

    *wasAllowed = m_inspectedPage->replayController()->unloadRecording();
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
