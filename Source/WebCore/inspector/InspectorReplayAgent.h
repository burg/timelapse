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

#ifndef InspectorReplayAgent_h
#define InspectorReplayAgent_h

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InspectorBaseAgent.h"
#include "InspectorFrontend.h"
#include "ReplayAgentStateMachine.h"
#include <wtf/HashMap.h>
#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>
#include <wtf/RefPtr.h>
#include <wtf/Vector.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

class DOMWindow;
class DocumentLoader;
class Element;
class Event;
class EventContext;
class Frame;
class InspectorObject;
class InspectorController;
class InspectorPageAgent;
class InstrumentingAgents;
class Node;
class Page;
class ReplayRecording;

typedef String ErrorString;

class InspectorReplayAgent : public InspectorBaseAgent, public InspectorReplayBackendDispatcherHandler {
    WTF_MAKE_NONCOPYABLE(InspectorReplayAgent);
public:
    static PassOwnPtr<InspectorReplayAgent> create(InstrumentingAgents* instrumentingAgents, InspectorPageAgent* pageAgent)
    {
        return adoptPtr(new InspectorReplayAgent(instrumentingAgents, pageAgent));
    }

    ~InspectorReplayAgent();

    virtual void didCreateFrontendAndBackend(InspectorFrontendChannel*, InspectorBackendDispatcher*) OVERRIDE;
    virtual void willDestroyFrontendAndBackend() OVERRIDE;

    // Callbacks from InspectorInstrumentation.
    void willDispatchEvent(const Event&, Frame*);
    void frameNavigated(DocumentLoader*);
#ifndef NDEBUG
    void willCallFunction(const String&, int scriptLine, Frame*);
#endif
    void recordingUnloaded();
    void recordingLoaded(PassRefPtr<ReplayRecording>);
    void recordingCreated(PassRefPtr<ReplayRecording>);
    void capturedEventLoopInput(EventLoopInput*);
    void captureStarted();
    void captureFinished();
    void playbackStarted();
    void playbackPaused(PositionMarkIndex);
    void playbackHitMark(PositionMarkIndex);
    void playbackFinished();
    void playbackCancelled();
    void playbackError(bool isFatal, const String&);

    bool capturing() const { return m_stateMachine.capturing(); }
    bool replaying() const { return m_stateMachine.replaying(); }

    // Figures out current state and stops everything.
    void stop();
    bool enabled() const;

    // Calls from the frontend.
    void enable(ErrorString*);
    void disable(ErrorString*);
    void isEnabled(ErrorString*, bool*);
    void startCapture(ErrorString*);
    void stopCapture(ErrorString*, bool*);
    void replayUpToMarkIndex(ErrorString*, int, bool);
    void replayToCompletion(ErrorString*, bool);
    void pausePlayback(ErrorString*);
    void stopPlayback(ErrorString*, bool);
    void setPauseOnError(ErrorString*, bool);
    void loadRecording(ErrorString*, int, bool*);
    void unloadRecording(ErrorString*, bool*);

    void getSerializedRecording(ErrorString*, int, RefPtr<TypeBuilder::Replay::ReplayRecording>&);
    void getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int>>&);

private:
    InspectorReplayAgent(InstrumentingAgents*, InspectorPageAgent*);
    PositionMark createMark();
    PositionMark reuseMark() const;
    void reset();

    // Helper method that's also shared with InspectorReplayAgent.
    PassRefPtr<ReplayRecording> findRecording(ErrorString*, int uid);

    std::unique_ptr<InspectorReplayFrontendDispatcher> m_frontendDispatcher;
    RefPtr<InspectorReplayBackendDispatcher> m_backendDispatcher;
    InspectorPageAgent* m_pageAgent;
    Page* m_page;
    ReplayAgentStateMachine m_stateMachine;
    unsigned m_nextMarkIndex;
    unsigned m_lastHitMarkIndex;
    bool m_inputLocked;

    typedef HashMap<int, RefPtr<ReplayRecording>, WTF::IntHash<int>, WTF::UnsignedWithZeroKeyHashTraits<int> > RecordingsMap;
    RecordingsMap m_recordingsMap;
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#endif // InspectorReplayAgent_h
