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

#ifndef ReplayController_h
#define ReplayController_h

#if ENABLE(TIMELAPSE)

#include "EventLoopInput.h"
#include "TimelapseProxy.h"
#include "Timer.h"
#include <wtf/Vector.h>
#include <wtf/Noncopyable.h>

namespace WTF {
    class AtomicString;
    class ReplayInputLog;
}

namespace WebCore {
    class CacheController;
    class Document;
    class DocumentLoader;
    class DOMWindow;
    class Element;
    class Event;
    class Node;
    class Page;
    class PlatformKeyboardEvent;
    class PlatformMouseEvent;
    class PlatformWheelEvent;
    class ReplayRecording;
    
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
  
    class ReplayController {
        WTF_MAKE_NONCOPYABLE(ReplayController);
    public:
        ReplayController(Page*);
        ~ReplayController();

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
        void frameNavigated(DocumentLoader*);
        void willFireTimer(int, Document*);
        void willRunPendingScriptsForDocument(Document*);
        void capturePageInput(EventLoopInput*);
        // callsites of this method are locations where replay errors are detected.
        // a true return value indicates playback has aborted or paused;
        // a false return value indicates that playback will continue unimpeded.
        bool playbackError(bool isFatal, const String& errorMessage);

        // Action post-dispatch callback
        void didDispatch(EventLoopInput*);
        
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
        PassRefPtr<WTF::ReplayInputLog> replayInputLog() const;
        // FIXME: temporary hack until some other object manages recordings
        ReplayRecording* loadedRecording() const { return m_loadedRecording; }

    private:
        void captureEventLoopInput(EventLoopInput*);
        void finalizePreviousInput(int currentDispatchCount);

        void maybeDispatchInput();
        void asyncDispatchInput();
        void syncDispatchInput();
        void timerFired(Timer<ReplayController>*);
        
        void resetPlayback();
        void pauseReplay(PositionMarkIndex);
        void finishReplay();

        void serialize();

        void changeProxyMode(TimelapseProxy::ProxyMode);
        
        // private accessor-- only cares if *some* JSDOMWindow in this Page is capturing/replaying
        bool capturing() const;
        bool replaying() const;

        Page* m_page;

        //used to implement "async" input dispatch
        Timer<ReplayController> m_timer;
        RefPtr<WTF::ReplayInputLog> m_replayInputLog;
        RefPtr<CacheController> m_cacheController;

        // During capture, the previously-captured input is stored to this variable. Upon
        // recording the next input, we save the number of DOM events dispatched between the
        // previous and next input as a member of the previous input. Then, when replaying, we 
        // can cross-check that each DOM event we see is supposed to happen, and if not, a useful 
        // stack trace is available.
        EventLoopInput* m_previousInput;

        // this pointer contains the next input to dispatch. The input could either be
        // waiting on a specific number of dom event dispatches, or on another input executing.
        EventLoopInput* m_waitingInput;
        // this pointer is set immediately before an input dispatch() method was called,
        // up until the corresponding didDispatch() callback to signal input completion.
        EventLoopInput* m_runningInput;
        bool m_dispatching;
        //for debugging purposes
        int m_domEventDispatchDepth;
        
        // number of events that have started dispatching, according to the tests inside
        // of willDispatchEvent(). It is incremented before the DOM event actually fires, but
        // before any such DOM event is captured into an input.
        int m_domEventDispatchCount;
        // used during replay to check for DOM event dispatch count consistency.
        int m_domEventRemainingQuota;

        ReplayStatus m_status;
        ReplayMode m_replayMode;
        ErrorMode m_errorStrategy;
        PositionMark m_currentMark;
        // in ReplayUpToMark mode, the mark which is being replayed up to (but not through)
        PositionMarkIndex m_stopBeforeMarkIndex;
        // the time at which the last input dispatch() method was called.
        double m_previousDispatchStartTime;
        // the time specified by the last dispatched input's mark.
        double m_previousMarkTime;
        
        int m_nextRecordingId;
        ReplayRecording* m_loadedRecording;
    };

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // ReplayController_h

