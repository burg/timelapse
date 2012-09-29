/*
 *  Copyright (C) 2012, Jake Bailey.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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

#include "SendResizeEvent.h"

#include "DeterminismController.h"
#include "DispatchEventBase.h"
#include "Frame.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

SendResizeEvent::SendResizeEvent(const Frame* frame)
    : DispatchableAction(ReplayableTypes::SendResizeEvent)
    , m_width(frame->document()->domWindow()->outerWidth())
    , m_height(frame->document()->domWindow()->outerHeight())
    , m_frameIndex(SerializedEventTarget::frameIndexFromDocument(frame->document())) {}

void SendResizeEvent::dispatch(DeterminismController* controller)
{
    ASSERT(sealed());

    Document* document = SerializedEventTarget::documentFromFrameIndex(controller->page(), m_frameIndex);

    document->domWindow()->resizeTo((float) m_width, (float) m_height);
    controller->page()->userInputProxy()->sendResizeEvent(document->frame(), true);
    // TODO: flushing this may be unsafe for some reason, if there are other things in the
    // document event queue that cannot be dispatched correctly without the stack unwinding.
    // If we encounter random crashes when replaying resize events, then we may need to
    // find another strategy, such as adding synthetic callback events or routing a callback
    // somehow.
    document->eventQueue()->flush();
    controller->didDispatch(this);
}

String SendResizeEvent::toString() const
{
    StringBuilder sb;
    sb.append(makeString("Resize("));
    sb.append(makeString("size=[", String::number(m_width), ",", String::number(m_height), "];"));
    sb.append(")");
    return sb.toString();
}

void SendResizeEvent::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("width", m_width);
    serializer->putInt("height", m_height);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
