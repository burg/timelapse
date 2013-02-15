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

#include "config.h"

#if ENABLE(TIMELAPSE)

#include "TimerFired.h"

#include "DeterminismController.h"
#include "DispatchEventBase.h"
#include "Document.h"
#include "DOMTimer.h"
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ReplayableAction.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

TimerFired::TimerFired(int timerId, Document* document, unsigned dispatchCount, const PositionMark& mark)
: DispatchableAction(ReplayableTypes::TimerFired, dispatchCount, mark)
, m_timerId(timerId)
, m_frameIndex(SerializedEventTarget::frameIndexFromDocument(document)) {}


String TimerFired::toString() const
{
    return makeString("TimerFired(", String::number(m_frameIndex), "/", String::number(m_timerId), ")");
}

void TimerFired::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("timerId", m_timerId);
    serializer->putInt("frameIndex", m_frameIndex);
}

void TimerFired::dispatch(DeterminismController* controller)
{
    ASSERT(sealed());
    Document* document = SerializedEventTarget::documentFromFrameIndex(controller->page(), m_frameIndex);

    //get the timer from SEC and fire it.
    DOMTimer* timer = document->findTimeout(m_timerId);
    if (timer)
        timer->fired();
    else {
        LOG_ERROR("%-30s REPLAY DIVERGENCE! Couldn't find and fire timer %d/%d.\n",
                  "[DeterminismController]", m_frameIndex, m_timerId);
    }
    
    controller->didDispatch(this);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
