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

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "ReplayController.h"
#include "DocumentLoader.h"
#include "DOMWindow.h"
#include "Element.h"
#include "Event.h"
#include "EventContext.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "Frame.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "InspectorController.h"
#include "InspectorDebuggerAgent.h"
#include "InspectorFrontend.h"
#include "InspectorState.h"
#include "InspectorReplayAgent.h"
#include "InspectorValues.h"
#include "InstrumentingAgents.h"
#include "JSDOMGlobalObject.h"
#include "Logging.h"
#include "Node.h"
#include "Page.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ReplayInputTypes.h"
#include "ReplayRecording.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceWillSendRequest.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "ReplayAgentStateMachine.h"
#include "ReplayActionFactory.h"
#include <wtf/OwnPtr.h>
#include <wtf/RefCounted.h>
#include <wtf/UnusedParam.h>
#include <wtf/Vector.h>
#include <wtf/text/AtomicString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

#include <unistd.h>
#include <errno.h>
#include <limits>

using namespace std;
using namespace WTF;

namespace ReplayPersistentAgentState {
static const char replayEnabled[] = "replayEnabled";
}

// This must be kept in sync with ReplayAgent.js so that record types and data are decoded properly.
namespace ReplayActionType {
static const char MousePress[] = "MousePress";
static const char MouseRelease[] = "MouseRelease";
static const char MouseMove[] = "MouseMove";
static const char MouseWheel[] = "MouseWheel";
static const char KeyPress[] = "KeyPress";
static const char Scroll[] = "Scroll";
static const char Resize[] = "Resize";

static const char WindowActive[] = "WindowActive";
static const char WindowInactive[] = "WindowInactive";
static const char WindowFocused[] = "WindowFocused";
static const char WindowUnfocused[] = "WindowUnfocused";

static const char RequestResource[] = "RequestResource";
static const char ReceiveResponse[] = "ReceiveResponse";
static const char ReceiveData[] = "ReceiveData";
static const char ResourceLoaded[] = "ResourceLoaded";

static const char TimerFire[] = "TimerFire";

static const char FrameNavigated[] = "FrameNavigated";
static const char CaptureBegin[] = "CaptureBegin";
static const char CaptureEnd[] = "CaptureEnd";
}

namespace WebCore {

// this function is only necessary because we don't have 1:1 mapping between
// replay action types and user-visible names. Disambiguations below.
static const char* getFrontendTypeForAction(EventLoopInput* action)
{
    if (action->type() == ReplayInputTypes::TimerFired)
        return ReplayActionType::TimerFire;
    if (action->type() == ReplayInputTypes::HandleMouseMove)
        return ReplayActionType::MouseMove;
    if (action->type() == ReplayInputTypes::HandleMousePress)
        return ReplayActionType::MousePress;
    if (action->type() == ReplayInputTypes::HandleMouseRelease)
        return ReplayActionType::MouseRelease;
    if (action->type() == ReplayInputTypes::HandleWheelEvent)
        return ReplayActionType::MouseWheel;
    if (action->type() == ReplayInputTypes::HandleKeyPress)
        return ReplayActionType::KeyPress;
    if (action->type() == ReplayInputTypes::ScrollPage)
        return ReplayActionType::Scroll;
    if (action->type() == ReplayInputTypes::SendResizeEvent)
        return ReplayActionType::Resize;
    if (action->type() == ReplayInputTypes::ResourceWillSendRequest)
        return ReplayActionType::RequestResource;
    if (action->type() == ReplayInputTypes::ResourceDidReceiveResponse)
        return ReplayActionType::ReceiveResponse;
    if (action->type() == ReplayInputTypes::ResourceDidReceiveData)
        return ReplayActionType::ReceiveData;
    if (action->type() == ReplayInputTypes::ResourceDidFinishLoading)
        return ReplayActionType::ResourceLoaded;
    
    if (action->type() == ReplayInputTypes::FocusSetActive) {
        bool toState = static_cast<FocusSetActive*>(action)->toState();
        return (toState) ? ReplayActionType::WindowActive
                         : ReplayActionType::WindowInactive;
    }
    if (action->type() == ReplayInputTypes::FocusSetFocused) {
        bool toState = static_cast<FocusSetFocused*>(action)->toState();
        return (toState) ? ReplayActionType::WindowFocused
                         : ReplayActionType::WindowUnfocused;
    }
    
    // actions that should not be user visible must override EventLoopInput::isUserVisible()
    ASSERT_NOT_REACHED();
    return 0;
}

static PassRefPtr<InspectorObject> createFrontendDataForAction(EventLoopInput* action)
{
    if (action->type() == ReplayInputTypes::FocusSetActive ||
        action->type() == ReplayInputTypes::FocusSetFocused ||
        action->type() == ReplayInputTypes::TimerFired)
        return ReplayActionFactory::createEmptyData();
    if (action->type() == ReplayInputTypes::HandleMouseMove)
        return ReplayActionFactory::createMouseData(static_cast<HandleMouseMove*>(action)->platformEvent());
    if (action->type() == ReplayInputTypes::HandleMousePress)
        return ReplayActionFactory::createMouseData(static_cast<HandleMousePress*>(action)->platformEvent());
    if (action->type() == ReplayInputTypes::HandleMouseRelease)
        return ReplayActionFactory::createMouseData(static_cast<HandleMouseRelease*>(action)->platformEvent());
    if (action->type() == ReplayInputTypes::HandleWheelEvent)
        return ReplayActionFactory::createWheelData(static_cast<HandleWheelEvent*>(action)->platformEvent());
    if (action->type() == ReplayInputTypes::HandleKeyPress)
        return ReplayActionFactory::createKeyPressData(static_cast<HandleKeyPress*>(action)->platformEvent());
    if (action->type() == ReplayInputTypes::ScrollPage)
        return ReplayActionFactory::createScrollData(static_cast<ScrollPage*>(action));
    if (action->type() == ReplayInputTypes::SendResizeEvent)
        return ReplayActionFactory::createResizeData(static_cast<SendResizeEvent*>(action));
    if (action->type() == ReplayInputTypes::ResourceWillSendRequest)
        return ReplayActionFactory::createRequestResourceData(static_cast<ResourceWillSendRequest*>(action));
    if (action->type() == ReplayInputTypes::ResourceDidReceiveResponse)
        return ReplayActionFactory::createReceiveResponseData(static_cast<ResourceDidReceiveResponse*>(action));
    if (action->type() == ReplayInputTypes::ResourceDidReceiveData)
        return ReplayActionFactory::createReceiveDataData(static_cast<ResourceDidReceiveData*>(action));
    if (action->type() == ReplayInputTypes::ResourceDidFinishLoading)
        return ReplayActionFactory::createResourceLoadedData(static_cast<ResourceDidFinishLoading*>(action));
    
    // actions that should not be user visible must override EventLoopInput::isUserVisible()
    ASSERT_NOT_REACHED();
    return 0;
}

static PassRefPtr<TypeBuilder::Replay::ReplayAction> createInspectorObjectForAction(EventLoopInput* action)
{       
    RefPtr<TypeBuilder::Replay::Mark> markObject = TypeBuilder::Replay::Mark::create()
        .setTimestamp(action->mark().time())
        .setIndex(action->mark().index());

    return TypeBuilder::Replay::ReplayAction::create()
            .setMark(markObject.release())
            .setType(getFrontendTypeForAction(action))
            .setData(createFrontendDataForAction(action))
            .release();
}

class ActionCollector {
public:
    typedef PassRefPtr<TypeBuilder::Array<TypeBuilder::Replay::ReplayAction> > ReturnType;

    ActionCollector()
    : m_actions(TypeBuilder::Array<TypeBuilder::Replay::ReplayAction>::create()) {}
    ~ActionCollector() {}
    void operator()(size_t, NondeterministicInput* replayAction)
    {
        ASSERT(replayAction->queue() == EventLoopInputQueue);
        
        EventLoopInput* action = static_cast<EventLoopInput*>(replayAction);
        if (!action->isUserVisible())
            return;
        
        m_actions->addItem(createInspectorObjectForAction(action));
    }
    ReturnType returnValue() { return m_actions.release(); }
    
private:
    RefPtr<TypeBuilder::Array<TypeBuilder::Replay::ReplayAction> > m_actions;
};

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

void InspectorReplayAgent::recordingUnloaded()
{
    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingUnloaded);

    if (m_frontend)
        m_frontend->recordingUnloaded();
}

void InspectorReplayAgent::recordingLoaded(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    // in case we didn't know about the loaded recording, add here.
    m_recordingsMap.add(recording->uid(), recording);
    
    m_stateMachine.advanceTo(ReplayAgentStateMachine::RecordingLoaded);
    
    if (m_frontend)
        m_frontend->recordingLoaded(recording->uid());
}

void InspectorReplayAgent::recordingCreated(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RecordingsMap::AddResult result = m_recordingsMap.add(recording->uid(), recording);
    // can't have two recordings with same uid
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontend)
        m_frontend->recordingAdded(recording->uid());
    
    // automatically load the created recording if nothing else is loaded.
    if (m_stateMachine.inState(ReplayAgentStateMachine::RecordingUnloaded)) {
        m_inspectedPage->replayController()->loadRecording(recording);
    }
}

void InspectorReplayAgent::capturedPageInput(EventLoopInput* action)
{
    // this instrumentation should only fire when we are actually capturing.
    // if it's some transient state, the caller should know not to call.
    ASSERT(capturing());

    PositionMark newMark = createMark();
    action->setMark(newMark);

    if (!m_frontend)
        return;
    if (!action->isUserVisible())
        return;

    m_frontend->capturedAction(createInspectorObjectForAction(action));
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

    PositionMark mark = createMark();
    m_inspectedPage->replayController()->beginCapturing(mark);
}

void InspectorReplayAgent::stopCapture(ErrorString*, bool* wasAllowed)
{
    PositionMark mark = createMark();
    *wasAllowed = m_inspectedPage->replayController()->endCapturing(mark);
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
    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *wasAllowed = false;
        *errorString = "Couldn't find recording with specified uid";
        return;
    }
    *wasAllowed = m_inspectedPage->replayController()->loadRecording(it->value);
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

void InspectorReplayAgent::getRecording(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Replay::ReplayRecording>& recordingObject)
{
    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *errorString = "Couldn't find recording with specified uid";
        return;
    }

    ActionCollector collector;
    RefPtr<TypeBuilder::Array<TypeBuilder::Replay::ReplayAction> > actions = it->value->forEachInputInQueue(EventLoopInputQueue, collector);

    recordingObject = TypeBuilder::Replay::ReplayRecording::create()
                        .setUid(it->value->uid())
                        .setDateCreated(it->value->creationTimestamp())
                        .setName("Dummy replay name")
                        .setActions(actions);
}

void InspectorReplayAgent::getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int> >& recordingsList)
{
    recordingsList = TypeBuilder::Array<int>::create();
    for (RecordingsMap::iterator it = m_recordingsMap.begin(); it != m_recordingsMap.end(); ++it) {
        recordingsList->addItem(it->key);
    }
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
