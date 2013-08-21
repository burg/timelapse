/*
 *  Copyright (C) 2011-2013 Brian Burg.
 *  Copyright (C) 2011-2013 University of Washington. All rights reserved.
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
#include "EventLoopInputDispatcher.h"

#if ENABLE(WEB_REPLAY)
#include "Document.h"
#include "DocumentEventQueue.h"
#include "EventLoopInput.h"
#include "Frame.h"
#include "Logging.h"
#include "Page.h"
#include "ReplayInputIterator.h"
#include "SentinelActions.h"

#include <wtf/text/CString.h>
#include <wtf/replay/InputIterator.h>
#include <wtf/replay/NondeterministicInput.h>

namespace WebCore {

EventLoopInputDispatcher::EventLoopInputDispatcher(Page* page, ReplayInputIterator* it, EventLoopInputDispatcherClient* client)
    : m_page(page)
    , m_client(client)
    , m_iterator(it)
    , m_timer(this, &EventLoopInputDispatcher::timerFired)
    , m_waitingInput(0)
    , m_runningInput(0)
    , m_dispatching(false)
    , m_running(false)
    , m_domEventDispatchCount(0)
    , m_domEventRemainingQuota(0)
    , m_mode(FullSpeed)
    , m_currentMark(0)
    , m_previousDispatchStartTime(0.0)
    , m_previousMarkTime(0.0) { }

EventLoopInputDispatcher::~EventLoopInputDispatcher()
{
}

PassOwnPtr<EventLoopInputDispatcher> EventLoopInputDispatcher::create(Page* page, ReplayInputIterator* it, EventLoopInputDispatcherClient* client)
{
    return adoptPtr(new EventLoopInputDispatcher(page, it, client));
}

//-- replay API
void EventLoopInputDispatcher::run()
{
    if (m_running)
        return;

    m_running = true;

    LOG(DeterministicReplay, "%-20s Running...\n", "ReplayEvents");
    maybeDispatchInput();
}

void EventLoopInputDispatcher::pause()
{
    if (!m_running)
        return;

    m_running = false;

    LOG(DeterministicReplay, "%-20s Pausing...\n", "ReplayEvents");
    if (m_timer.isActive())
        m_timer.stop();
}

//-- external callbacks
void EventLoopInputDispatcher::incrementDomEventCounter()
{
    m_domEventDispatchCount++;
    m_domEventRemainingQuota--;

    if (m_domEventRemainingQuota < 0) {
        if (m_timer.isActive()) {
            //fire the timer early to try and inject the next event before the "willDispatchEvent" event happens.
            m_timer.stop();
            syncDispatchInput();
        } else {
            // This usually indicates nondeterministic APIs, or reordering of dispatchable inputs and DOM events.
            String errorMessage = String::format("more DOM events were dispatched (%d) than expected (%d) before the next input.", m_runningInput->DOMEventQuota(), m_runningInput->DOMEventQuota()-1);
            m_client->playbackError(false, errorMessage);
        }
    }
}

// Private methods

void EventLoopInputDispatcher::didDispatch(EventLoopInput* input)
{
    if (!m_runningInput) {
        LOG(DeterministicReplay, "%-20s Clearing pending didDispatch flag, since it appears replay stopped while processing this event (i.e., inside a debugger's inner event loop, or because of a fatal replay error)\n", "ReplayEvents");
        return;
    }
    ASSERT(m_dispatching);
    ASSERT(input == m_runningInput);
#ifdef NDEBUG
    UNUSED_PARAM(input);
#endif // !defined(NDEBUG)

    m_runningInput = 0;
    m_dispatching = false;
    m_client->didDispatchInput(input);

    // if the expected input never came, just forget we were expecting it.
    // it may have been consumed by another instrumenting agent.
    maybeDispatchInput();
}

void EventLoopInputDispatcher::maybeDispatchInput()
{
    // if something is already in the midst of being replayed, then do nothing.
    if (!m_running || m_runningInput)
        return;

    // if there was an error between now the previous dispatch, report it now.
    if (m_iterator->hasError()) {
        // TODO: some of these should be recoverable, but for now they are all fatal.
        // we must clear the error
        m_client->playbackError(true, m_iterator->errorMessage());
        return;
    }

    // if there is no waiting input, then get one.
    if (!m_waitingInput)
        m_waitingInput = static_cast<EventLoopInput*>(m_iterator->uncheckedLoadInput(NondeterministicInput::EventLoopInputQueue));

    ASSERT(m_waitingInput);
    m_currentMark = m_waitingInput->mark();

    DEFINE_STATIC_LOCAL(const AtomicString, endSentinel, ("EndSentinel", AtomicString::ConstructFromLiteral));

    if (m_waitingInput->type() == endSentinel) {
        m_client->didDispatchFinalInput();
        return;
    }

    //if this event is overdue, then the replay has diverged (probably caused by user interaction)
    if (m_waitingInput->dispatchCounted() && m_waitingInput->dispatchCount() < m_domEventDispatchCount) {
        String errorMessage = String::format("Next input should be injected after %d retired DOM events, but %d DOM events have retired.",
                                             m_waitingInput->dispatchCount(),
                                             m_domEventDispatchCount);

        m_client->playbackError(false, errorMessage);
    }

    m_client->willDispatchInput(m_waitingInput);
    if (!m_running) // could be changed by client in the previous call, so re-check.
        return;

    //if this event is next in line or overdue, promote it to "running", then fire immediately.
    if (!m_waitingInput->dispatchCounted() || m_waitingInput->dispatchCount() <= m_domEventDispatchCount) {
        m_runningInput = m_waitingInput;
        m_waitingInput = 0;
        asyncDispatchInput();
    }

    //otherwise, it will be considered for dispatch after every future event.
    else
        LOG(DeterministicReplay, "%-20s Waiting to dispatch next input (current: %d@; target: %d@).\n",
            "ReplayEvents", m_domEventDispatchCount, m_waitingInput->dispatchCount());
}

void EventLoopInputDispatcher::timerFired(Timer<EventLoopInputDispatcher>*)
{
    syncDispatchInput();
}

void EventLoopInputDispatcher::asyncDispatchInput()
{
    ASSERT(m_runningInput);

    if (m_timer.isActive())
        m_timer.stop();

    switch (m_mode) {
    case FullSpeed:
        // delay 1ms so will happen after 0ms delay timers fire
        m_timer.startOneShot(1.0 * 0.001);
        break;

    case Realtime: {
        // The goal is to reproduce the delay between dispatched inputs that
        // was observed during the recording. So, we need to compute how much time
        // to wait such that the elapsed time (since previous dispatch) plus the wait
        // time (until next dispatch) will equal the observed delay between the
        // previous and current input.

        // sometimes, the previous mark time isn't set for some reason.
        if (m_previousMarkTime == 0.0)
            m_previousMarkTime = m_runningInput->mark().time();

        double targetInterval = m_runningInput->mark().time() - m_previousMarkTime;
        double elapsed = monotonicallyIncreasingTime() - m_previousDispatchStartTime;
        double waitInterval = targetInterval - elapsed;

        // a negative wait time means that dispatch took longer on replay than on
        // capture. In this case, proceed without waiting at all (subject to
        // the nonzero interval condition as in the FullSpeed replay mode).
        if (waitInterval < 0.0)
            waitInterval = (1.0 * 0.001);

        LOG(DeterministicReplay, "%-20s (WAIT: %.3f ms)", "ReplayEvents", waitInterval*1000.0);

        if (waitInterval > 1000.0) {
            LOG_ERROR("%-20s ERROR: tried to wait for over 1000 seconds; this is probably a bug.",
                      "ReplayEvents");
            waitInterval = 1.0 * 0.001;
        }

        m_timer.startOneShot(waitInterval);
        break;
    }
    }
}

void EventLoopInputDispatcher::syncDispatchInput()
{
    ASSERT(m_runningInput);

    // flush document event queue before dispatching our own events.
    m_page->mainFrame()->document()->eventQueue()->flush();

    if (m_mode == Realtime) {
        m_previousDispatchStartTime = monotonicallyIncreasingTime();
        m_previousMarkTime = m_runningInput->mark().time();
    }
    m_domEventRemainingQuota = m_runningInput->DOMEventQuota();
    LOG(DeterministicReplay, "%-20s ----------------------------------------------",
                   "ReplayEvents");
    LOG(DeterministicReplay, "%-20s >DISPATCH: %s\n", "ReplayEvents",
                   m_runningInput->toString().utf8().data());
    m_dispatching = true;
    m_runningInput->dispatch(m_page->replayController(), this);
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
