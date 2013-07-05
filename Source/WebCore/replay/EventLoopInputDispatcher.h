/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#ifndef EventLoopInputDispatcher_h
#define EventLoopInputDispatcher_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "Timer.h"
#include <wtf/Noncopyable.h>
#include <wtf/OwnPtr.h>
#include <wtf/Vector.h>
#include <wtf/text/WTFString.h>

namespace WTF {
    class InputIterator;
}

namespace WebCore {

class Page;
class ReplayInputIterator;

enum ReplayMode {
    FullSpeed,
    Realtime,
};

class EventLoopInputDispatcherClient {
public:
    EventLoopInputDispatcherClient() {}
    virtual ~EventLoopInputDispatcherClient() {}

    virtual void playbackError(bool isFatal, const String& errorMessage) =0;
    virtual void willDispatchInput(EventLoopInput*) =0;
    virtual void didDispatchInput(EventLoopInput*) =0;
    virtual void didDispatchFinalInput() =0;
};

class EventLoopInputDispatcher {
    WTF_MAKE_NONCOPYABLE(EventLoopInputDispatcher);
public:
    ~EventLoopInputDispatcher();
    static PassOwnPtr<EventLoopInputDispatcher> create(Page*, ReplayInputIterator*, EventLoopInputDispatcherClient*);

    // Main API
    void run();
    void pause();
    void setMode(ReplayMode mode) { m_mode = mode; }
    ReplayMode mode() const { return m_mode; }
    const PositionMark& currentMark() const { return m_currentMark; }

    // External callbacks
    void incrementDomEventCounter();
    void maybeDispatchInput();

    // Post-dispatch callback
    void didDispatch(EventLoopInput*);

private:
    EventLoopInputDispatcher(Page*, ReplayInputIterator*,
                             EventLoopInputDispatcherClient*);
    void asyncDispatchInput();
    void syncDispatchInput();
    void timerFired(Timer<EventLoopInputDispatcher>*);

    Page* m_page;
    EventLoopInputDispatcherClient* m_client;
    ReplayInputIterator* m_iterator;
    Timer<EventLoopInputDispatcher> m_timer;

    // this pointer contains the next input to dispatch. The input could either be
    // waiting on a specific number of dom event dispatches, or on another input executing.
    EventLoopInput* m_waitingInput;
    // this pointer is set immediately before an input dispatch() method was called,
    // up until the corresponding didDispatch() callback to signal input completion.
    EventLoopInput* m_runningInput;
    bool m_dispatching;
    bool m_running;

    int m_domEventDispatchCount;
    // used during replay to check for DOM event dispatch count consistency.
    int m_domEventRemainingQuota;

    ReplayMode m_mode;
    PositionMark m_currentMark;
    // the time at which the last input dispatch() method was called.
    double m_previousDispatchStartTime;
    // the time specified by the last dispatched input's mark.
    double m_previousMarkTime;
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // EventLoopInputDispatcher_h

