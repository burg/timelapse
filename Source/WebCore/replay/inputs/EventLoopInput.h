/*
 *  Copyright (C) 2011, 2012 Brian Burg.
 *  Copyright (C) 2011, 2012 University of Washington. All rights reserved.
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

#ifndef EventLoopInput_h
#define EventLoopInput_h

#if ENABLE(WEB_REPLAY)

#include <wtf/CurrentTime.h>
#include <wtf/replay/NondeterministicInput.h>

namespace WebCore {

class ReplayController;
class DocumentLoader;
class Event;
class EventLoopInputDispatcher;
class EventTarget;
class EncoderContext;
class Node;
class ResourceResponse;

typedef unsigned PositionMarkIndex;
struct PositionMark {
public:
    explicit PositionMark()
    : m_index(0)
    , m_time(0.0) {}

    PositionMark(PositionMarkIndex index)
    : m_index(index)
    , m_time(monotonicallyIncreasingTime()) {}

    PositionMarkIndex index() const { return m_index; }
    double time() const { return m_time; }

private:
    PositionMarkIndex m_index;
    double m_time;
};

class EventLoopInput : public NondeterministicInput {

public:
    EventLoopInput(int ticksCount, const PositionMark& mark)
    : m_executionTicksCount(ticksCount)
    , m_executionTicksQuota(-1)
    , m_mark(mark)
    , m_sealed(false)
    , m_dispatchCounted(true) {}

    EventLoopInput()
    : m_executionTicksCount(-1)
    , m_executionTicksQuota(-1)
    , m_mark(PositionMark())
    , m_sealed(false)
    , m_dispatchCounted(true) {}

    EventLoopInput(bool dispatchCounted)
    : m_executionTicksCount(0)
    , m_executionTicksQuota(0)
    , m_mark(PositionMark())
    , m_sealed(true)
    , m_dispatchCounted(dispatchCounted) {}

    virtual ~EventLoopInput() {};

    // NondeterministicInput API
    virtual String toString() const =0;
    virtual size_t memorySize() const =0;

    virtual void dispatch(ReplayController&, EventLoopInputDispatcher&) =0;

    virtual NondeterministicInput::QueueType queue() const { return NondeterministicInput::EventLoopInputQueue; }
    virtual bool isUserVisible() const { return true; }
    virtual void serializeDispatchInfo(EncoderContext&) const;

    // mark, dispatch count, and quota are not always known at construction time. They can
    // only be set when the event is "unsealed".

    void setExecutionTicksCount(unsigned count) { ASSERT(!m_sealed); m_executionTicksCount = count; }
    virtual int executionTicksCount() const { return m_executionTicksCount; }

    void setMark(const PositionMark& mark) { ASSERT(!m_sealed); m_mark = mark; }
    PositionMark mark() const { return m_mark; }

    void setExecutionTicksQuota(unsigned quota) { ASSERT(!m_sealed); m_executionTicksQuota = quota; }
    int executionTicksQuota() const { return m_executionTicksQuota; }

    bool dispatchCounted() const { return m_dispatchCounted; }

    void seal()
    {
        ASSERT(m_executionTicksQuota > -1);
        ASSERT(m_executionTicksCount > -1);
        ASSERT(!m_sealed);

        m_sealed = true;
    }

    bool sealed() const { return m_sealed; }

private:
    // For debugging purposes, we count the number of execution ticks before
    // this input is dispatched,and the number of ticks that happen as a
    // result of dispatching the event. We also ensure that
    int m_executionTicksCount;
    int m_executionTicksQuota;
    PositionMark m_mark;
    bool m_sealed;
    // Whether or not this is a "real" event loop input.
    // PlaybackError is the only input for which this is false.
    // FIXME: is this actually necessary?
    bool m_dispatchCounted;

};

} //namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // EventLoopInput_h
