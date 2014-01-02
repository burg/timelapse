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

#include "config.h"
#include "EventLoopInputDispatcher.h"

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "JSONEncoderContext.h"
#include "Logging.h"
#include "Page.h"
#include "ReplayInputIterator.h"
#include <inspector/InspectorValues.h>
#include <wtf/TemporaryChange.h>
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/text/CString.h>

namespace WebCore {

EventLoopInputDispatcher::EventLoopInputDispatcher(Page* page, ReplayInputIterator* it, EventLoopInputDispatcherClient* client)
    : m_page(page)
    , m_client(client)
    , m_iterator(it)
    , m_timer(this, &EventLoopInputDispatcher::timerFired)
    , m_runningInput(nullptr)
    , m_dispatching(false)
    , m_running(false)
    , m_elapsedTicks(0)
    , m_mode(FullSpeed)
    , m_currentMark(0)
    , m_previousDispatchStartTime(0.0)
    , m_previousMarkTime(0.0)
{
}

EventLoopInputDispatcher::~EventLoopInputDispatcher()
{
}

void EventLoopInputDispatcher::run()
{
    if (m_running)
        return;

    m_running = true;

    LOG(DeterministicReplay, "%-20s Running...\n", "ReplayEvents");
    dispatchInputSoon();
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

void EventLoopInputDispatcher::incrementExecutionTicks()
{
    // Ticks should not be added if we are not dispatching an event loop input.
    ASSERT(m_dispatching && m_runningInput);

    m_elapsedTicks++;

    if (m_runningInput->executionTicksQuota() < m_elapsedTicks) {
        // This usually indicates nondeterministic APIs, or reordering of dispatchable inputs and DOM events.
        String errorMessage = String::format("OVERFLOW: more DOM events were dispatched (%d) than expected (%d) before the next input.", m_elapsedTicks, m_runningInput->executionTicksQuota());
        m_client->playbackError(false, errorMessage);
    }
}

void EventLoopInputDispatcher::timerFired(Timer<EventLoopInputDispatcher>*)
{
    dispatchInput();
}

void EventLoopInputDispatcher::dispatchInputSoon()
{
    ASSERT(m_running);

    // We may already have an input if replay was paused just before dispatching.
    if (!m_runningInput) {
        m_runningInput = static_cast<EventLoopInput*>(m_iterator->uncheckedLoadInput(NondeterministicInput::EventLoopInputQueue));
        m_currentMark = m_runningInput->mark();
    }

    if (m_timer.isActive())
        m_timer.stop();

    switch (m_mode) {
    case FullSpeed:
        // Delay 1ms so will happen after 0ms delay timers fire.
        m_timer.startOneShot(1.0 * 0.001);
        break;

    case Realtime: {
        // The goal is to reproduce the delay between dispatched inputs that
        // was observed during the recording. So, we need to compute how much time
        // to wait such that the elapsed time (since previous dispatch) plus the wait
        // time (until next dispatch) will equal the observed delay between the
        // previous and current input.

        // FIXME: sometimes, the previous mark time isn't set for some reason.
        if (m_previousMarkTime == 0.0)
            m_previousMarkTime = m_runningInput->mark().time();

        double targetInterval = m_runningInput->mark().time() - m_previousMarkTime;
        double elapsed = monotonicallyIncreasingTime() - m_previousDispatchStartTime;
        double waitInterval = targetInterval - elapsed;

        // A negative wait time means that dispatch took longer on replay than on
        // capture. In this case, proceed without waiting at all (subject to
        // the nonzero interval condition as in the FullSpeed replay mode).
        if (waitInterval < 0.0)
            waitInterval = (1.0 * 0.001);

        LOG(DeterministicReplay, "%-20s (WAIT: %.3f ms)", "ReplayEvents", waitInterval * 1000.0);

        if (waitInterval > 1000.0) {
            LOG_ERROR("%-20s ERROR: tried to wait for over 1000 seconds; this is probably a bug.", "ReplayEvents");
            waitInterval = 1.0 * 0.001;
        }

        m_timer.startOneShot(waitInterval);
        break;
    }
    }
}

void EventLoopInputDispatcher::dispatchInput()
{
    ASSERT(m_runningInput && m_runningInput->sealed());
    ASSERT(!m_dispatching);

    if (m_mode == Realtime) {
        m_previousDispatchStartTime = monotonicallyIncreasingTime();
        m_previousMarkTime = m_runningInput->mark().time();
    }

#if !LOG_DISABLED
    std::unique_ptr<EncoderContext> encoder = JSONCoder::createMap();
    encoder->encodeInput(m_runningInput);
    RefPtr<Inspector::InspectorValue> value = static_cast<JSONEncoderContext*>(encoder.get())->encodedValue();
    String jsonString = value->toJSONString();

    LOG(DeterministicReplay, "%-20s ----------------------------------------------", "ReplayEvents");
    LOG(DeterministicReplay, "%-20s >DISPATCH: %s %s\n", "ReplayEvents", m_runningInput->type().string().utf8().data(), jsonString.utf8().data());
#endif

    m_client->willDispatchInput(*m_runningInput);
    // Client could stop replay in the previous callback, so check again.
    if (!m_running)
        return;

    {
        m_elapsedTicks = 0;
        TemporaryChange<bool> change(m_dispatching, true);
        m_runningInput->dispatch(m_page->replayController());
    }

    EventLoopInput* dispatchedInput = m_runningInput;
    m_runningInput = nullptr;

    // Notify clients that the event was dispatched.
    m_client->didDispatchInput(*dispatchedInput);
    DEFINE_STATIC_LOCAL(const AtomicString, endSentinel, ("EndSentinel", AtomicString::ConstructFromLiteral));
    if (dispatchedInput->type() == endSentinel) {
        m_client->didDispatchFinalInput();
        return;
    }

    // Check for DOM event underflow.
    if (dispatchedInput->executionTicksQuota() > m_elapsedTicks) {
        String errorMessage = String::format("UNDERFLOW: fewer DOM events were dispatched (%d) than expected (%d) before the next input.", m_elapsedTicks, dispatchedInput->executionTicksQuota());
        m_client->playbackError(false, errorMessage);
    }

    // If there was a memoization error, report it now.
    if (m_iterator->hasError())
        m_client->playbackError(true, m_iterator->errorMessage());

    // Clients could stop replay during event dispatch, or from any callback above.
    if (!m_running)
        return;

    dispatchInputSoon();
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
