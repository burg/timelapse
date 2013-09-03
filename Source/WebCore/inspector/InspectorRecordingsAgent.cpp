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
#include "InspectorRecordingsAgent.h"

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "FunctorInputIterator.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "InstrumentingAgents.h"
#include "JSONInputEncoder.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ReplayRecording.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceWillSendRequest.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "ReplayActionFactory.h"

namespace WebCore {

// TODO(Issue #271): remove backend-side interpretation of inputs
// This must be kept in sync with RecordingsAgent.js so that record types and data are decoded properly.
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

static const char ReloadFrame[] = "ReloadFrame";
static const char FrameNavigated[] = "FrameNavigated";
static const char CaptureBegin[] = "CaptureBegin";
static const char CaptureEnd[] = "CaptureEnd";
}

// this function is only necessary because we don't have 1:1 mapping between
// replay action types and user-visible names. Disambiguations below.
static const char* getFrontendTypeForAction(const EventLoopInput& action)
{
    if (action.type() == inputTypes().TimerFired)
        return ReplayActionType::TimerFire;
    if (action.type() == inputTypes().HandleMouseMove)
        return ReplayActionType::MouseMove;
    if (action.type() == inputTypes().HandleMousePress)
        return ReplayActionType::MousePress;
    if (action.type() == inputTypes().HandleMouseRelease)
        return ReplayActionType::MouseRelease;
    if (action.type() == inputTypes().HandleWheelEvent)
        return ReplayActionType::MouseWheel;
    if (action.type() == inputTypes().HandleKeyPress)
        return ReplayActionType::KeyPress;
    if (action.type() == inputTypes().ReloadFrame)
        return ReplayActionType::ReloadFrame;
    if (action.type() == inputTypes().ScrollPage)
        return ReplayActionType::Scroll;
    if (action.type() == inputTypes().SendResizeEvent)
        return ReplayActionType::Resize;
    if (action.type() == inputTypes().ResourceWillSendRequest)
        return ReplayActionType::RequestResource;
    if (action.type() == inputTypes().ResourceDidReceiveResponse)
        return ReplayActionType::ReceiveResponse;
    if (action.type() == inputTypes().ResourceDidReceiveData)
        return ReplayActionType::ReceiveData;
    if (action.type() == inputTypes().ResourceDidFinishLoading)
        return ReplayActionType::ResourceLoaded;

    if (action.type() == inputTypes().FocusSetActive) {
        bool toState = static_cast<const FocusSetActive&>(action).toState();
        return (toState) ? ReplayActionType::WindowActive
                         : ReplayActionType::WindowInactive;
    }
    if (action.type() == inputTypes().FocusSetFocused) {
        bool toState = static_cast<const FocusSetFocused&>(action).toState();
        return (toState) ? ReplayActionType::WindowFocused
                         : ReplayActionType::WindowUnfocused;
    }

    // actions that should not be user visible must override EventLoopInput::isUserVisible()
    ASSERT_NOT_REACHED();
    return 0;
}

static PassRefPtr<InspectorObject> createFrontendDataForAction(const EventLoopInput& action)
{
    if (action.type() == inputTypes().FocusSetActive ||
        action.type() == inputTypes().FocusSetFocused ||
        action.type() == inputTypes().ReloadFrame ||        
        action.type() == inputTypes().TimerFired)
        return ReplayActionFactory::createEmptyData();
    if (action.type() == inputTypes().HandleMouseMove)
        return ReplayActionFactory::createMouseData(static_cast<const HandleMouseMove&>(action).platformEvent());
    if (action.type() == inputTypes().HandleMousePress)
        return ReplayActionFactory::createMouseData(static_cast<const HandleMousePress&>(action).platformEvent());
    if (action.type() == inputTypes().HandleMouseRelease)
        return ReplayActionFactory::createMouseData(static_cast<const HandleMouseRelease&>(action).platformEvent());
    if (action.type() == inputTypes().HandleWheelEvent)
        return ReplayActionFactory::createWheelData(static_cast<const HandleWheelEvent&>(action).platformEvent());
    if (action.type() == inputTypes().HandleKeyPress)
        return ReplayActionFactory::createKeyPressData(static_cast<const HandleKeyPress&>(action).platformEvent());
    if (action.type() == inputTypes().ScrollPage)
        return ReplayActionFactory::createScrollData(static_cast<const ScrollPage&>(action));
    if (action.type() == inputTypes().SendResizeEvent)
        return ReplayActionFactory::createResizeData(static_cast<const SendResizeEvent&>(action));
    if (action.type() == inputTypes().ResourceWillSendRequest)
        return ReplayActionFactory::createRequestResourceData(static_cast<const ResourceWillSendRequest&>(action));
    if (action.type() == inputTypes().ResourceDidReceiveResponse)
        return ReplayActionFactory::createReceiveResponseData(static_cast<const ResourceDidReceiveResponse&>(action));
    if (action.type() == inputTypes().ResourceDidReceiveData)
        return ReplayActionFactory::createReceiveDataData(static_cast<const ResourceDidReceiveData&>(action));
    if (action.type() == inputTypes().ResourceDidFinishLoading)
        return ReplayActionFactory::createResourceLoadedData(static_cast<const ResourceDidFinishLoading&>(action));

    // actions that should not be user visible must override EventLoopInput::isUserVisible()
    ASSERT_NOT_REACHED();
    return 0;
}

// TODO(Issue #271): remove backend-side interpretation of inputs
PassRefPtr<TypeBuilder::Recordings::ReplayAction>
InspectorRecordingsAgent::createInspectorObjectForAction(const EventLoopInput& action)
{
    RefPtr<TypeBuilder::Recordings::Mark> markObject = TypeBuilder::Recordings::Mark::create()
        .setTimestamp(action.mark().time())
        .setIndex(action.mark().index());

    return TypeBuilder::Recordings::ReplayAction::create()
            .setMark(markObject.release())
            .setType(getFrontendTypeForAction(action))
            .setData(createFrontendDataForAction(action))
            .release();
}

class ActionCollector {
public:
    typedef PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayAction> > ReturnType;

    ActionCollector()
    : m_actions(TypeBuilder::Array<TypeBuilder::Recordings::ReplayAction>::create()) {}
    ~ActionCollector() {}
    void operator()(size_t, NondeterministicInput* replayAction)
    {
        ASSERT(replayAction->queue() == NondeterministicInput::EventLoopInputQueue);

        const EventLoopInput& action = static_cast<const EventLoopInput&>(*replayAction);
        if (!action.isUserVisible())
            return;

        // TODO(Issue #271): remove backend-side interpretation of inputs
        m_actions->addItem(InspectorRecordingsAgent::createInspectorObjectForAction(action));
    }
    ReturnType returnValue() { return m_actions.release(); }

private:
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayAction> > m_actions;
};

InspectorRecordingsAgent::InspectorRecordingsAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state)
: InspectorBaseAgent<InspectorRecordingsAgent>("Recordings", instrumentingAgents, state)
, m_instrumentingAgents(instrumentingAgents)
{
    m_instrumentingAgents->setInspectorRecordingsAgent(this);
}

InspectorRecordingsAgent::~InspectorRecordingsAgent()
{
    m_instrumentingAgents->setInspectorRecordingsAgent(0);
    m_instrumentingAgents = 0;
    m_state = 0;
}

void InspectorRecordingsAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->recordings();
}

void InspectorRecordingsAgent::clearFrontend()
{
    m_frontend = 0;
}

PassRefPtr<ReplayRecording> InspectorRecordingsAgent::findRecording(ErrorString* errorString, int uid)
{
    ASSERT(uid >= 0);

    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *errorString = "Couldn't find recording with specified uid";
        return 0;
    }

    return it->value;
}

void InspectorRecordingsAgent::recordingLoaded(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    // in case we didn't know about the loaded recording, add here.
    m_recordingsMap.add(recording->uid(), recording);
}

void InspectorRecordingsAgent::recordingCreated(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RecordingsMap::AddResult result = m_recordingsMap.add(recording->uid(), recording);
    // can't have two recordings with same uid
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontend)
        m_frontend->recordingAdded(recording->uid());
}

void InspectorRecordingsAgent::getRecording(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Recordings::ReplayRecording>& recordingObject)
{

    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording)
        return;

    ActionCollector collector;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayAction> > actions = recording->createFunctorIterator()->forEachInputInQueue(NondeterministicInput::EventLoopInputQueue, collector);

    recordingObject = TypeBuilder::Recordings::ReplayRecording::create()
                        .setUid(recording->uid())
                        .setDateCreated(recording->creationTimestamp())
                        .setActions(actions);
}

void InspectorRecordingsAgent::getSerializedRecording(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Recordings::ReplayRecordingNew>& serializedObject)
{
    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording)
        return;

    JSONInputEncoder coder;
    serializedObject = coder.serialize(recording);
}

void InspectorRecordingsAgent::getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int> >& recordingsList)
{
    recordingsList = TypeBuilder::Array<int>::create();
    for (RecordingsMap::iterator it = m_recordingsMap.begin(); it != m_recordingsMap.end(); ++it) {
        recordingsList->addItem(it->key);
    }
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
