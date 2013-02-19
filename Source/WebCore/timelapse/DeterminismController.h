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

#ifndef DeterminismController_h
#define DeterminismController_h

#if ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include "TimelapseProxy.h"
#include "Timer.h"
#include <wtf/Vector.h>
#include <wtf/Noncopyable.h>

namespace WTF {
    class AtomicString;
    class DeterminismLog;
}

namespace WebCore {
    class CacheController;
    class Document;
    class DocumentLoader;
    class DOMWindow;
    class Element;
    class Event;
    class Frame;
    class Node;
    class Page;
    class PlatformKeyboardEvent;
    class PlatformMouseEvent;
    class PlatformWheelEvent;
    
    enum ReplayStatus {
        CannotReplay,
        ReplayToStart,
        ReplayUpToMarkIndex,
        ReplayToCompletion,
        PlaybackUninitialized,
        PlaybackResetting,
        PlaybackPaused,
        PlaybackFinished
    };

    enum ReplayMode {
        FullSpeed,
        Realtime,
    };
  
    enum ErrorMode {
        PauseOnError,
        ContinueOnError,
    };
  
    class DeterminismController {
        WTF_MAKE_NONCOPYABLE(DeterminismController);
    public:
        DeterminismController(Page*);
        ~DeterminismController();

        // Main API
        void beginCapturing(const PositionMark&);
        bool endCapturing(const PositionMark&);
        void pauseAtNextMark();
        void replayUpToMarkIndex(PositionMarkIndex, ReplayMode mode = FullSpeed);
        void replayToCompletion(ReplayMode mode = FullSpeed);
        void cancelPlayback();
        
        // External callbacks
        void willDispatchEvent(const Event&, DOMWindow*, Node*, const PositionMark&);
        void didDispatchEvent();
        void frameNavigated(DocumentLoader*, const PositionMark&);
        void willFireTimer(int, Frame*, const PositionMark&);
        void willRunPendingScriptsForDocument(Document*);
        void capturePageInput(DispatchableAction* action);
        // callsites of this method are locations where replay errors are detected.
        // a true return value indicates playback has aborted or paused;
        // a false return value indicates that playback will continue unimpeded.
        bool playbackError(bool isFatal, const String& errorMessage);

        // Action post-dispatch callback
        void didDispatch(DispatchableAction*);
        
        // Accessors and queries

        // There can be several Documents/JSDOMWindows per Page. If the old document is about to unload and
        // the new document has started recording the first resource, then replaying() should be false for
        // the first document and true for the second document.
        bool isCapturingDocument(Document*) const;
        bool isReplayingDocument(Document*) const;
        
        ErrorMode errorStrategy() const { return m_errorStrategy; }
        void setErrorStrategy(ErrorMode mode) { m_errorStrategy = mode; }

        Page* page() const { return m_page; }
        PassRefPtr<CacheController> cacheController() const;
        PassRefPtr<WTF::DeterminismLog> determinismLog() const;

    private:
        void captureAction(DispatchableAction* newAction);
        void finalizePreviousAction(int currentDispatchCount);

        void maybeDispatchAction();
        void asyncDispatchAction();
        void syncDispatchAction();
        void timerFired(Timer<DeterminismController>*);
        
        void resetPlayback();
        void pauseReplay(PositionMarkIndex);
        void finishReplay();

        void serialize();

        void changeProxyMode(TimelapseProxy::ProxyMode);
        
        // private accessor-- only cares if *some* JSDOMWindow in this Page is capturing/replaying
        bool capturing() const;
        bool replaying() const;

        Page* m_page;

        //used to implement "async" action dispatch
        Timer<DeterminismController> m_timer;
        RefPtr<WTF::DeterminismLog> m_determinismLog;
        RefPtr<CacheController> m_cacheController;

        // During capture, the previously-captured action is stored to this variable. Upon
        // recording the next action, we save the number of DOM events dispatched between the
        // previous and next action as a member of the previous action. Then, when replaying, we 
        // can cross-check that each DOM event we see is supposed to happen, and if not, a useful 
        // stack trace is available.
        DispatchableAction* m_previousAction;

        // this pointer contains the next action to dispatch. The action could either be
        // waiting on a specific number of dom event dispatches, or on another action executing.
        DispatchableAction* m_waitingAction;
        // this pointer is set immediately before an action's dispatch() method was called,
        // up until the corresponding didDispatch() callback to signal action completion.
        DispatchableAction* m_runningAction;
        bool m_dispatching;
        //for debugging purposes
        int m_domEventDispatchDepth;
        
        // number of events that have started dispatching, according to the tests inside
        // of willDispatchEvent(). It is incremented before the DOM event actually fires, but
        // before any such DOM event is captured into an action.
        int m_domEventDispatchCount;
        // used during replay to check for DOM event dispatch count consistency.
        int m_domEventRemainingQuota;

        ReplayStatus m_status;
        ReplayMode m_replayMode;
        ErrorMode m_errorStrategy;
        PositionMark m_currentMark;
        // in ReplayUpToMark mode, the mark which is being replayed up to (but not through)
        PositionMarkIndex m_stopBeforeMarkIndex;
        // the time at which the last action's dispatch() method was called.
        double m_previousActionDispatchStartTime;
        // the time specified by the last dispatched action's mark.
        double m_previousMarkTime;
    };

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // DeterminismController_h

