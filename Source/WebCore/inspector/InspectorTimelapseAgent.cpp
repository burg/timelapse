/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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
#include "InspectorTimelapseAgent.h"

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "DeterminismController.h"
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
#include "InspectorTimelapseAgent.h"
#include "InspectorValues.h"
#include "InstrumentingAgents.h"
#include "JSDOMGlobalObject.h"
#include "Logging.h"
#include "Node.h"
#include "Page.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ReplayableTypes.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceWillSendRequest.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "TimelapseAgentStateMachine.h"
#include "TimelapseRecordFactory.h"
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

namespace TimelapsePersistentAgentState {
static const char timelapseEnabled[] = "timelapseEnabled";
}

// This must be kept in sync with TimelapseAgent.js so that record types and data are decoded properly.
namespace TimelapseRecordType {
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

InspectorTimelapseAgent::InspectorTimelapseAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage)
: InspectorBaseAgent<InspectorTimelapseAgent>("Timelapse", instrumentingAgents, state)
, m_instrumentingAgents(instrumentingAgents)
, m_inspectedPage(inspectedPage)
, m_nextMarkIndex(0)
, m_lastHitMarkIndex(numeric_limits<unsigned>::max())
, m_inputLocked(false) {}

InspectorTimelapseAgent::~InspectorTimelapseAgent()
{
    // if destroying timelapseAgent, then stop instrumenting for marks (if we are)
    m_instrumentingAgents->setInspectorTimelapseAgent(0);
    m_instrumentingAgents = 0;
    m_state = 0;
    m_inspectedPage = 0;
}

void InspectorTimelapseAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->timelapse();
    if (m_state->getBoolean(TimelapsePersistentAgentState::timelapseEnabled)) {
        ErrorString error;
        enable(&error);
    }
}

void InspectorTimelapseAgent::clearFrontend()
{
    //TODO: stop instrumenting, stop capturing, etc. see InspectorTimelineAgent::clearFrontend
    m_frontend = 0;
}

void InspectorTimelapseAgent::willDispatchEvent(const Event& event, DOMWindow* window, Node* node, const Vector<EventContext>&)
{
    if (capturing() || replaying())
        m_inspectedPage->determinismController()->willDispatchEvent(event, window, node, reuseMark());
}

void InspectorTimelapseAgent::didDispatchEvent()
{
    if (capturing() || replaying())
        m_inspectedPage->determinismController()->didDispatchEvent();
}

void InspectorTimelapseAgent::willDispatchEventOnWindow(const Event& event, DOMWindow* window)
{
    if (capturing() || replaying())
        m_inspectedPage->determinismController()->willDispatchEvent(event, window, 0, reuseMark());
}

void InspectorTimelapseAgent::didDispatchEventOnWindow()
{
    didDispatchEvent();
}

void InspectorTimelapseAgent::frameNavigated(DocumentLoader* loader)
{
    if (!capturing() && !replaying())
        return;

    PositionMark mark = createMark();
    m_inspectedPage->determinismController()->frameNavigated(loader, mark);
}

void InspectorTimelapseAgent::willFireTimer(int timerId, Frame* frame)
{
    if (!capturing() && !replaying())
        return;

    PositionMark mark = createMark();
    m_inspectedPage->determinismController()->willFireTimer(timerId, frame, mark);

    if (capturing())
        pushRecordToFrontend(TimelapseRecordFactory::createEmptyData(), TimelapseRecordType::TimerFire, mark);
}

void InspectorTimelapseAgent::capturedPageInput(DispatchableAction* action)
{
    // this instrumentation should only fire when we are actually capturing.
    // if it's some transient state, the caller should know not to call.
    ASSERT(capturing());

    PositionMark newMark = createMark();
    action->setMark(newMark);

    // TODO: it would be nice to encapsulate knowledge about platform events, etc. so that TimelapseAgent doesn't need to know.
    //       the createXXXdata events should probably hidden inside TimelapseRecordFactory.
    if (action->type() == ReplayableTypes::HandleMouseMove) {
        PlatformMouseEvent mouseEvent = static_cast<HandleMouseMove*>(action)->platformEvent();
        pushRecordToFrontend(TimelapseRecordFactory::createMouseData(mouseEvent), TimelapseRecordType::MouseMove, newMark);
    } else if (action->type() == ReplayableTypes::HandleMousePress) {
        PlatformMouseEvent mouseEvent = static_cast<HandleMousePress*>(action)->platformEvent();
        pushRecordToFrontend(TimelapseRecordFactory::createMouseData(mouseEvent), TimelapseRecordType::MousePress, newMark);
    } else if (action->type() == ReplayableTypes::HandleMouseRelease) {
        PlatformMouseEvent mouseEvent = static_cast<HandleMouseRelease*>(action)->platformEvent();
        pushRecordToFrontend(TimelapseRecordFactory::createMouseData(mouseEvent), TimelapseRecordType::MouseRelease, newMark);
    } else if (action->type() == ReplayableTypes::HandleWheelEvent) {
        PlatformWheelEvent wheelEvent = static_cast<HandleWheelEvent*>(action)->platformEvent();
        pushRecordToFrontend(TimelapseRecordFactory::createWheelData(wheelEvent), TimelapseRecordType::MouseWheel, newMark);
    } else if (action->type() == ReplayableTypes::HandleKeyPress) {
        PlatformKeyboardEvent keyEvent = static_cast<HandleKeyPress*>(action)->platformEvent();
        pushRecordToFrontend(TimelapseRecordFactory::createKeyPressData(keyEvent), TimelapseRecordType::KeyPress, newMark);
    } else if (action->type() == ReplayableTypes::FocusSetActive) {
        bool toState = static_cast<FocusSetActive*>(action)->toState();
        pushRecordToFrontend(TimelapseRecordFactory::createEmptyData(), 
                             (toState) ? TimelapseRecordType::WindowActive : TimelapseRecordType::WindowInactive,
                             newMark);
    } else if (action->type() == ReplayableTypes::FocusSetFocused) {
        bool toState = static_cast<FocusSetFocused*>(action)->toState();
        pushRecordToFrontend(TimelapseRecordFactory::createEmptyData(), 
                             (toState) ? TimelapseRecordType::WindowFocused : TimelapseRecordType::WindowUnfocused,
                             newMark);
    } else if (action->type() == ReplayableTypes::ScrollPage) {
        pushRecordToFrontend(TimelapseRecordFactory::createScrollData(static_cast<ScrollPage*>(action)), TimelapseRecordType::Scroll, newMark);
    } else if (action->type() == ReplayableTypes::SendResizeEvent) {
        pushRecordToFrontend(TimelapseRecordFactory::createResizeData(static_cast<SendResizeEvent*>(action)), TimelapseRecordType::Resize, newMark);
    } else if (action->type() == ReplayableTypes::ResourceWillSendRequest) {
        pushRecordToFrontend(TimelapseRecordFactory::createRequestResourceData(static_cast<ResourceWillSendRequest*>(action)), TimelapseRecordType::RequestResource, newMark);
    } else if (action->type() == ReplayableTypes::ResourceDidReceiveResponse) {
        pushRecordToFrontend(TimelapseRecordFactory::createReceiveResponseData(static_cast<ResourceDidReceiveResponse*>(action)), TimelapseRecordType::ReceiveResponse, newMark);
    } else if (action->type() == ReplayableTypes::ResourceDidReceiveData) {
        pushRecordToFrontend(TimelapseRecordFactory::createReceiveDataData(static_cast<ResourceDidReceiveData*>(action)), TimelapseRecordType::ReceiveData, newMark);
    } else if (action->type() == ReplayableTypes::ResourceDidFinishLoading) {
        pushRecordToFrontend(TimelapseRecordFactory::createResourceLoadedData(static_cast<ResourceDidFinishLoading*>(action)), TimelapseRecordType::ResourceLoaded, newMark);
    }
}
    
void InspectorTimelapseAgent::captureStarted()
{
    LOG(Timelapse, "-----CAPTURE START-----");
    
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::Capturing);
    m_inputLocked = false;
    if (m_frontend) {
        m_frontend->captureWasStarted();
        m_frontend->inputUnlocked();
    }

}

void InspectorTimelapseAgent::captureFinished()
{
    LOG(Timelapse, "-----CAPTURE STOP-----");
    
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::EnabledCanReplayOrCapture);
    
    if (m_frontend)
        m_frontend->captureWasStopped();
}

void InspectorTimelapseAgent::playbackStarted()
{
    LOG(Timelapse, "-----REPLAY START-----");
    
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::Replaying);
    m_inputLocked = true;
    if (m_frontend) {
        m_frontend->playbackWasStarted();
        m_frontend->inputLocked();
    }
}

void InspectorTimelapseAgent::playbackPaused(PositionMarkIndex index)
{
    LOG(Timelapse, "-----REPLAY PAUSED-----");

    m_stateMachine.advanceTo(TimelapseAgentStateMachine::ReplayPaused);
    if (m_frontend)
        m_frontend->playbackWasPaused(index);
}

void InspectorTimelapseAgent::playbackHitMark(PositionMarkIndex index)
{
    if (m_lastHitMarkIndex == index)
        return;
    m_lastHitMarkIndex = index;
    
    if (m_frontend)
        m_frontend->playbackHitMark(index);
}

void InspectorTimelapseAgent::playbackFinished()
{
    LOG(Timelapse, "-----REPLAY STOP-----");
    
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::EnabledCanReplayOrCapture);
    if (m_frontend)
        m_frontend->playbackFinished();
}

void InspectorTimelapseAgent::playbackCancelled()
{
    m_inputLocked = false;

    if (m_frontend)
        m_frontend->inputUnlocked();
}

void InspectorTimelapseAgent::playbackError(bool isFatal, const String& errorMessage)
{
    // NB. if instead you would like to debug the failure,
    // this is a decent breakpoint location.
    if (m_frontend)
        m_frontend->playbackError(isFatal, errorMessage);
}

PositionMark InspectorTimelapseAgent::createMark()
{
    return  PositionMark(m_nextMarkIndex++);
}

PositionMark InspectorTimelapseAgent::reuseMark() const
{
    return PositionMark(m_nextMarkIndex);
}

void InspectorTimelapseAgent::pushRecordToFrontend(PassRefPtr<InspectorObject> data, const String& type, const PositionMark& mark)
{
    ASSERT(capturing());

    if (!m_frontend)
        return;

    RefPtr<TypeBuilder::Timelapse::Mark> checkedMark = TypeBuilder::Timelapse::Mark::create()
        .setTimestamp(mark.time())
        .setIndex(mark.index());

    RefPtr<TypeBuilder::Timelapse::TimelapseRecord> checkedRecord = TypeBuilder::Timelapse::TimelapseRecord::create()
        .setType(type)
        .setMark(checkedMark.release())
        .setData(data);
    m_frontend->capturedAction(checkedRecord.release());
}

void InspectorTimelapseAgent::stop()
{
  ErrorString dummy;
  bool dummy2;

  if (capturing())
      stopCapture(&dummy, &dummy2);
  else if (replaying())
      stopPlayback(&dummy, true);
}

void InspectorTimelapseAgent::isEnabled(ErrorString*, bool* result)
{
    *result = m_stateMachine.enabled();
}

void InspectorTimelapseAgent::enable(ErrorString*)
{
    if (m_stateMachine.enabled())
        return;
    
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::EnabledCanCapture);
    m_state->setBoolean(TimelapsePersistentAgentState::timelapseEnabled, true);
    m_instrumentingAgents->setInspectorTimelapseAgent(this);
    
    if (m_frontend)
        m_frontend->timelapseWasEnabled();
}

void InspectorTimelapseAgent::disable(ErrorString*)
{
    if (m_stateMachine.disabled())
        return;

    m_stateMachine.advanceTo(TimelapseAgentStateMachine::Disabled);
    m_state->setBoolean(TimelapsePersistentAgentState::timelapseEnabled, false);
    m_instrumentingAgents->setInspectorTimelapseAgent(0);

    if (m_frontend)
        m_frontend->timelapseWasDisabled();
}

void InspectorTimelapseAgent::startCapture(ErrorString*)
{   
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::WaitingForCapture);
    m_nextMarkIndex = 0;

    PositionMark mark = createMark();
    m_inspectedPage->determinismController()->beginCapturing(mark);
}

void InspectorTimelapseAgent::stopCapture(ErrorString*, bool* wasAllowed)
{
    PositionMark mark = createMark();
    *wasAllowed = m_inspectedPage->determinismController()->endCapturing(mark);
}

void InspectorTimelapseAgent::replayUpToMarkIndex(ErrorString*, int markIndex, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::WaitingForReplay);
    m_inspectedPage->determinismController()->replayUpToMarkIndex((unsigned)markIndex, (fastReplay) ? FullSpeed : Realtime);
}

void InspectorTimelapseAgent::replayToCompletion(ErrorString*, bool fastReplay)
{
#if ENABLE(JAVASCRIPT_DEBUGGER) && !defined(NDEBUG)
    // cannot start replay from within debugger event loop.
    InspectorDebuggerAgent* debuggerAgent = m_instrumentingAgents->inspectorDebuggerAgent();
    ASSERT(!debuggerAgent || !debuggerAgent->isPaused());
#endif
    m_stateMachine.advanceTo(TimelapseAgentStateMachine::WaitingForReplay);
    m_inspectedPage->determinismController()->replayToCompletion((fastReplay) ? FullSpeed : Realtime);
}

void InspectorTimelapseAgent::pausePlayback(ErrorString*)
{
    // this will fire InspectorInstrumentation::playbackPaused, and our
    // listener for that will change state machine and tell frontend.
    m_inspectedPage->determinismController()->pauseAtNextMark();
}
    
void InspectorTimelapseAgent::stopPlayback(ErrorString*, bool shouldUnlock)
{
    m_inputLocked = !shouldUnlock;   
    m_inspectedPage->determinismController()->cancelPlayback();
}

void InspectorTimelapseAgent::setPauseOnError(ErrorString*, bool shouldPause)
{
    m_inspectedPage->determinismController()->setErrorStrategy(shouldPause ? PauseOnError : ContinueOnError);
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
