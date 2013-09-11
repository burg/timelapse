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

#ifndef ReplayController_h
#define ReplayController_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInputDispatcher.h"
#include "ReplayProxy.h"
#include "Timer.h"
#include <wtf/Vector.h>
#include <wtf/Noncopyable.h>

namespace WTF {
    class InputIterator;
}

namespace WebCore {
    class CacheController;
    class Document;
    class DocumentLoader;
    class DOMWindow;
    class Element;
    class Event;
    class EventLoopInput;
    class Node;
    class Page;
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

    enum ErrorStrategy {
        PauseOnError,
        ContinueOnError,
    };

    class ReplayController : public EventLoopInputDispatcherClient {
        WTF_MAKE_NONCOPYABLE(ReplayController);
    public:
        ReplayController(Page*);
        ~ReplayController();

        // Main API
        void beginCapturing();
        bool endCapturing();
        void pauseAtNextMark();
        void replayUpToMarkIndex(PositionMarkIndex, ReplayMode mode = FullSpeed);
        void replayToCompletion(ReplayMode mode = FullSpeed);
        void cancelPlayback();

        // External callbacks
        void willDispatchEvent(const Event&, DOMWindow*, Node*, const PositionMark&);
        void didDispatchEvent();
        void frameNavigated(DocumentLoader*);
        void willFireTimer(int, Document*);

        // EventLoopInputDispatcherClient API
        virtual void playbackError(bool isFatal, const String& errorMessage) OVERRIDE;
        virtual void willDispatchInput(const EventLoopInput&) OVERRIDE;
        virtual void didDispatchInput(const EventLoopInput&) OVERRIDE;
        virtual void didDispatchFinalInput() OVERRIDE;

        // FrameCamera API
        void imageCaptured(const String& imageDataUri);

        // Accessors and queries
        WTF::InputIterator* activeIterator() const { return m_activeIterator.get(); }

        ErrorStrategy errorStrategy() const { return m_errorStrategy; }
        void setErrorStrategy(ErrorStrategy mode) { m_errorStrategy = mode; }

        Page* page() const { return m_page; }
        CacheController& cacheController() const;
        PassRefPtr<ReplayRecording> loadedRecording() const;

        bool loadRecording(PassRefPtr<ReplayRecording>, bool suppressNotifications = false);
        bool unloadRecording(bool suppressNotifications = false);

    private:
        void resetReplayState();
        void pauseReplay();
        void finishReplay();
        void changeProxyMode(ReplayProxy::ProxyMode);

        // private accessor-- only cares if *some* JSDOMWindow in this Page is capturing/replaying
        // TODO: remove
        bool capturing() const;
        bool replaying() const;

        EventLoopInputDispatcher& dispatcher() const;

        Page* m_page;

        int m_nextRecordingId;
        RefPtr<ReplayRecording> m_loadedRecording;
        OwnPtr<WTF::InputIterator> m_activeIterator;
        const OwnPtr<CacheController> m_cacheController;
        PositionMarkIndex m_stopBeforeMarkIndex;
        ReplayStatus m_status;
        ErrorStrategy m_errorStrategy;
    };

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // ReplayController_h

