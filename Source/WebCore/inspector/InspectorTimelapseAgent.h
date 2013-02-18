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

#ifndef InspectorTimelapseAgent_h
#define InspectorTimelapseAgent_h

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include "InspectorBaseAgent.h"
#include "InspectorFrontend.h"
#include "TimelapseAgentStateMachine.h"

#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>
#include <wtf/RefPtr.h>
#include <wtf/Vector.h>
#include <wtf/text/WTFString.h>
#include <wtf/text/CString.h>

namespace WebCore {

class DocumentLoader;
class DOMWindow;
class Element;
class Event;
class EventContext;
class Frame;
class InspectorObject;
class InspectorController;
class InspectorFrontend;
class InspectorCompositeState;
class InstrumentingAgents;
class Node;
class Page;

typedef String ErrorString;

 class InspectorTimelapseAgent
    : public InspectorBaseAgent<InspectorTimelapseAgent>
    , public InspectorBackendDispatcher::TimelapseCommandHandler {
    WTF_MAKE_NONCOPYABLE(InspectorTimelapseAgent);
public:
    static PassOwnPtr<InspectorTimelapseAgent> create(InstrumentingAgents* instrumentingAgents, InspectorCompositeState* state, Page* page)
    {
        return adoptPtr(new InspectorTimelapseAgent(instrumentingAgents, state, page));
    }
    
    ~InspectorTimelapseAgent();

    void setFrontend(InspectorFrontend*);
    void clearFrontend();

    // Calls from WebKit (InspectorInstrumentation/InstrumentingAgents)
    void willDispatchEvent(const Event&, DOMWindow*, Node*, const Vector<EventContext>&);
    void didDispatchEvent();
    void willDispatchEventOnWindow(const Event&, DOMWindow*);
    void didDispatchEventOnWindow();
    void frameNavigated(DocumentLoader*);
    void willFireTimer(int, Frame*);

    bool capturing() const { return m_stateMachine.capturing(); }
    bool replaying() const { return m_stateMachine.replaying(); }

    void capturedPageInput(DispatchableAction*);
    void captureStarted();
    void captureFinished();
    void playbackStarted();
    void playbackPaused(PositionMarkIndex);
    void playbackHitMark(PositionMarkIndex);
    void playbackFinished();
    void playbackCancelled();
    void playbackError(bool isFatal, const String&);

    // Figures out current state and stops everything. 
    void stop();
    bool enabled() const;

    // Calls from the frontend
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

private:
    InspectorTimelapseAgent(InstrumentingAgents*, InspectorCompositeState*, Page*);

    PositionMark createMark();
    PositionMark reuseMark() const;
    void pushRecordToFrontend(PassRefPtr<InspectorObject>, const String& type, const PositionMark&);
    
    InstrumentingAgents *m_instrumentingAgents;
    InspectorFrontend::Timelapse* m_frontend;
    Page *m_inspectedPage;
    TimelapseAgentStateMachine m_stateMachine;
    unsigned m_nextMarkIndex;
    unsigned m_lastHitMarkIndex;
    bool m_inputLocked;
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
#endif // InspectorTimelapseAgent_h
