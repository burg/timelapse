/*
 *  Copyright (C) 2011, Jake Bailey.
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

#include "SendResizeEvent.h"

#include "DeterminismController.h"
#include "Frame.h"
#include "DOMWindow.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

SendResizeEvent::SendResizeEvent(const IntSize& size)
    : DispatchableAction(ReplayableTypes::SendResizeEvent)
    , m_size(size) {}

void SendResizeEvent::dispatch(DeterminismController* controller)
{
    ASSERT(sealed());

    controller->page()->mainFrame()->domWindow()->resizeTo((float) m_size.width(), (float) m_size.height());
    controller->didDispatch(this);
}

String SendResizeEvent::toString() const
{
    StringBuilder sb;
    sb.append(makeString("Resize("));
    sb.append(makeString("size=[", String::number(m_size.width()), ",", String::number(m_size.height()), "];"));
    sb.append(")");
    return sb.toString();
}

void SendResizeEvent::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("width", m_size.width());
    serializer->putInt("height", m_size.height());
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
