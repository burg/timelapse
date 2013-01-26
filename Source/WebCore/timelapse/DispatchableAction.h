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

#ifndef DispatchableAction_h
#define DispatchableAction_h

#if ENABLE(TIMELAPSE)

#include <wtf/CurrentTime.h>
#include <wtf/PassRefPtr.h>
#include <wtf/timelapse/ActionSerializer.h>
#include <wtf/timelapse/ReplayableAction.h>

namespace WebCore {

    class DeterminismController;
    class DocumentLoader;
    class Event;
    class EventTarget;
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

class DispatchableAction : public ReplayableAction {

using ReplayableAction::ReplayableType;

public:
    DispatchableAction(ReplayableType type, int dispatchCount, const PositionMark& mark)
    : ReplayableAction(type)
    , m_dispatchCount(dispatchCount)
    , m_domEventQuota(-1)
    , m_mark(mark)
    , m_sealed(false)
    , m_dispatchCounted(true) {}

    DispatchableAction(ReplayableType type)
    : ReplayableAction(type)
    , m_dispatchCount(-1)
    , m_domEventQuota(-1)
    , m_mark(PositionMark())
    , m_sealed(false)
    , m_dispatchCounted(true) {}

    DispatchableAction(ReplayableType type, bool dispatchCounted)
    : ReplayableAction(type)
    , m_dispatchCount(0)
    , m_domEventQuota(0)
    , m_mark(PositionMark())
    , m_sealed(true)
    , m_dispatchCounted(dispatchCounted) {}

    virtual ~DispatchableAction() {};

    // ReplayableAction API
    virtual String toString() const =0;
    virtual size_t memorySize() const =0;
    virtual void serialize(ActionSerializer*) const =0;
    
    virtual void dispatch(DeterminismController*) =0;
    
    virtual DeterminismQueueType queue() const { return WTF::DispatchableActionQueue; }
    
    virtual void serializeDispatchInfo(ActionSerializer*) const OVERRIDE;
    
    // mark, dispatch count, and quota are not always known at construction time. They can
    // only be set when the event is "unsealed".

    void setDispatchCount(unsigned count) { ASSERT(!m_sealed); m_dispatchCount = count; }
    virtual int dispatchCount() const { return m_dispatchCount; }

    void setMark(const PositionMark& mark) { ASSERT(!m_sealed); m_mark = mark; }
    PositionMark mark() const { return m_mark; }
    
    void setDOMEventQuota(unsigned quota) { ASSERT(!m_sealed); m_domEventQuota = quota; }
    int DOMEventQuota() const { return m_domEventQuota; }

    // only actions added through DeterminismController::captureAction can be dispatch-
    // counted. DeterminismController will ignore the dispatch count of other actions.
    bool dispatchCounted() const { return m_dispatchCounted; }

    void seal()
    {
        ASSERT(m_domEventQuota > -1);
        ASSERT(m_dispatchCount > -1);
        ASSERT(!m_sealed);
        
        m_sealed = true;
    }
    
    bool sealed() const { return m_sealed; }

private:
    //for debugging purposes to ensure correct replay
    int m_dispatchCount;
    int m_domEventQuota;
    //used by clients to specify discrete units of the recording.
    //so, clients only need to track the marks that they have set,
    //instead of some implementation-specific detail like event dispatched count.
    PositionMark m_mark;
    bool m_sealed;
    bool m_dispatchCounted;
};

} //namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // DispatchableAction_h
