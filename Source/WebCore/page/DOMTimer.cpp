/*
 * Copyright (C) 2008 Apple Inc. All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

#include "config.h"
#include "DOMTimer.h"

#include "InspectorInstrumentation.h"
#include "ScheduledAction.h"
#include "ScriptExecutionContext.h"
#include "UserGestureIndicator.h"
#include <wtf/CurrentTime.h>
#include <wtf/HashSet.h>
#include <wtf/StdLibExtras.h>

#if ENABLE(WEB_REPLAY)
#include "DispatchEventBase.h"
#include "ReplayInputTypes.h"
#include "ReplayUtilities.h"
#include "TimerCreated.h"
#include <wtf/replay/InputIterator.h>
#include <wtf/replay/NondeterministicInput.h>
#endif

using namespace std;

namespace WebCore {

static const int maxIntervalForUserGestureForwarding = 1000; // One second matches Gecko.
static const int maxTimerNestingLevel = 5;
static const double oneMillisecond = 0.001;

static int timerNestingLevel = 0;

#if ENABLE(WEB_REPLAY)
class InstrumentedDOMTimer : public DOMTimer {
public:
    InstrumentedDOMTimer(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int originalInterval);
    virtual ~InstrumentedDOMTimer() {}
protected:
    virtual void start(int timeout, bool singleShot) OVERRIDE;
};

class DeterministicDOMTimer : public DOMTimer {
public:
    DeterministicDOMTimer(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int originalInterval);
    virtual ~DeterministicDOMTimer() {}
protected:
    virtual void start(int timeout, bool singleShot) OVERRIDE;
};
    
InstrumentedDOMTimer::InstrumentedDOMTimer(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int originalInterval)
: DOMTimer(context, action, originalInterval) {}

void InstrumentedDOMTimer::start(int timeout, bool singleShot)
{
    // Schedule the timer normally, then save the timeoutId assigned by the execution context.
    DOMTimer::start(timeout, singleShot);
    if (!scriptExecutionContext()->isDocument())
        return;

    Document* document = static_cast<Document*>(scriptExecutionContext());
    InputIterator* it = getInputIteratorForDocument(document);
    ASSERT(it && it->isCapturing());

    int frameIndex = SerializedEventTarget::frameIndexFromDocument(document);
    it->storeInput(adoptPtr(new TimerCreated(m_timeoutId, frameIndex)));
}

DeterministicDOMTimer::DeterministicDOMTimer(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int originalInterval)
: DOMTimer(context, action, originalInterval)
{
    // Override the default behavior set in DOMTimer constructor.
    m_shouldScheduleNormally = false;
}

void DeterministicDOMTimer::start(int, bool)
{
    if (!scriptExecutionContext()->isDocument())
        return;

    Document* document = static_cast<Document*>(scriptExecutionContext());
    InputIterator* it = getInputIteratorForDocument(document);
    ASSERT(it && it->isReplaying());

    NondeterministicInput* input = it->loadInput(NondeterministicInput::ScriptMemoizedDataQueue, inputTypes().TimerCreated);
    TimerCreated* castedInput = static_cast<TimerCreated*>(input);
    // Error handling case: if fetch failed, schedule normally.
    if (!castedInput)
        return;

    // Check that this timer was created in the same Document as originally observed.
    ASSERT_UNUSED(document, castedInput->document(document->page()) == document);
    // Set the timeoutId from memoized data, and register the timer with the execution context.
    m_timeoutId = castedInput->timerId();
    bool wasAdded = scriptExecutionContext()->addTimeout(m_timeoutId, this);
    ASSERT_UNUSED(wasAdded, wasAdded);
}
#endif

static inline bool shouldForwardUserGesture(int interval, int nestingLevel)
{
    return UserGestureIndicator::processingUserGesture()
        && interval <= maxIntervalForUserGestureForwarding
        && nestingLevel == 1; // Gestures should not be forwarded to nested timers.
}

DOMTimer::DOMTimer(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int interval)
    : SuspendableTimer(context)
    , m_timeoutId(0)
    , m_shouldScheduleNormally(true)
    , m_nestingLevel(timerNestingLevel + 1)
    , m_action(action)
    , m_originalInterval(interval)
    , m_shouldForwardUserGesture(shouldForwardUserGesture(interval, m_nestingLevel)) {}

DOMTimer::~DOMTimer()
{
    if (scriptExecutionContext())
        scriptExecutionContext()->removeTimeout(m_timeoutId);
}

void DOMTimer::start(int interval, bool singleShot)
{

    // Keep asking for the next id until we're given one that we don't already have.
    do {
        m_timeoutId = scriptExecutionContext()->circularSequentialID();
    } while (!scriptExecutionContext()->addTimeout(m_timeoutId, this));

    double intervalMilliseconds = intervalClampedToMinimum(interval, scriptExecutionContext()->minimumTimerInterval());

    if (singleShot)
        startOneShot(intervalMilliseconds);
    else
        startRepeating(intervalMilliseconds);
}

int DOMTimer::install(ScriptExecutionContext* context, PassOwnPtr<ScheduledAction> action, int timeout, bool singleShot)
{
    DOMTimer* timer = 0;
#if ENABLE(WEB_REPLAY)
    do {
        if (!context->isDocument())
            break;
        InputIterator* it = getInputIteratorForDocument(static_cast<Document*>(context));
        if (it && it->isCapturing())
            timer = new InstrumentedDOMTimer(context, action, timeout);
        if (it && it->isReplaying())
            timer = new DeterministicDOMTimer(context, action, timeout);
    } while (0);
    if (!timer)
#endif
    timer = new DOMTimer(context, action, timeout);

    // DOMTimer::start() links the new timer into a list of ActiveDOMObjects held by the 'context'.
    // The timer is deleted when context is deleted (DOMTimer::contextDestroyed) or explicitly via DOMTimer::removeById(),
    // or if it is a one-time timer and it has fired (DOMTimer::fired).
    timer->start(timeout, singleShot);
    timer->suspendIfNeeded();
    InspectorInstrumentation::didInstallTimer(context, timer->m_timeoutId, timeout, singleShot);

    return timer->m_timeoutId;
}

void DOMTimer::removeById(ScriptExecutionContext* context, int timeoutId)
{
    // timeout IDs have to be positive, and 0 and -1 are unsafe to
    // even look up since they are the empty and deleted value
    // respectively
    if (timeoutId <= 0)
        return;

    InspectorInstrumentation::didRemoveTimer(context, timeoutId);

    delete context->findTimeout(timeoutId);
}

void DOMTimer::fired()
{
    ScriptExecutionContext* context = scriptExecutionContext();
    timerNestingLevel = m_nestingLevel;
    ASSERT(!isSuspended());
    ASSERT(!context->activeDOMObjectsAreSuspended());
    UserGestureIndicator gestureIndicator(m_shouldForwardUserGesture ? DefinitelyProcessingUserGesture : PossiblyProcessingUserGesture);
    // Only the first execution of a multi-shot timer should get an affirmative user gesture indicator.
    m_shouldForwardUserGesture = false;

    InspectorInstrumentationCookie cookie = InspectorInstrumentation::willFireTimer(context, m_timeoutId);

    // For non-schedulable timers, simply fire the action.
    if (!m_shouldScheduleNormally) {
        // Don't delete the timer if it's not scheduled normally. The action may be reused later
        // if it is a non-one-shot timer. It will be cleaned by destroyContext().
        m_action->execute(context);
    } else if (isActive()) {
    // For non-one-shot timers, update the interval and fire the action.
        double minimumInterval = context->minimumTimerInterval();
        if (repeatInterval() && repeatInterval() < minimumInterval) {
            m_nestingLevel++;
            if (m_nestingLevel >= maxTimerNestingLevel)
                augmentRepeatInterval(minimumInterval - repeatInterval());
        }

        // No access to member variables after this point, it can delete the timer.
        m_action->execute(context);
    } else {
        // Delete timer before executing the action for one-shot timers.
        OwnPtr<ScheduledAction> action = m_action.release();
            
        // No access to member variables after this point.
        delete this;
        action->execute(context);
        timerNestingLevel = 0;
    }

    InspectorInstrumentation::didFireTimer(cookie);
}

void DOMTimer::contextDestroyed()
{
    SuspendableTimer::contextDestroyed();
    delete this;
}

void DOMTimer::didStop()
{
    // Need to release JS objects potentially protected by ScheduledAction
    // because they can form circular references back to the ScriptExecutionContext
    // which will cause a memory leak.
    m_action.clear();
}

void DOMTimer::adjustMinimumTimerInterval(double oldMinimumTimerInterval)
{
    if (!m_shouldScheduleNormally)
        return;
    if (m_nestingLevel < maxTimerNestingLevel)
        return;

    double newMinimumInterval = scriptExecutionContext()->minimumTimerInterval();
    double newClampedInterval = intervalClampedToMinimum(m_originalInterval, newMinimumInterval);

    if (repeatInterval()) {
        augmentRepeatInterval(newClampedInterval - repeatInterval());
        return;
    }

    double previousClampedInterval = intervalClampedToMinimum(m_originalInterval, oldMinimumTimerInterval);
    augmentFireInterval(newClampedInterval - previousClampedInterval);
}

double DOMTimer::intervalClampedToMinimum(int timeout, double minimumTimerInterval) const
{
    double intervalMilliseconds = max(oneMillisecond, timeout * oneMillisecond);

    if (intervalMilliseconds < minimumTimerInterval && m_nestingLevel >= maxTimerNestingLevel)
        intervalMilliseconds = minimumTimerInterval;
    return intervalMilliseconds;
}

double DOMTimer::alignedFireTime(double fireTime) const
{
    double alignmentInterval = scriptExecutionContext()->timerAlignmentInterval();
    if (alignmentInterval) {
        double currentTime = monotonicallyIncreasingTime();
        if (fireTime <= currentTime)
            return fireTime;

        double alignedTime = ceil(fireTime / alignmentInterval) * alignmentInterval;
        return alignedTime;
    }

    return fireTime;
}

} // namespace WebCore
