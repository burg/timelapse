/*
 *  Copyright (C) 2012, Brian Burg.
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

#include "DispatchFakeMouseMove.h"

#include "AsyncEventProxy.h"
#include "DeterminismController.h"
#include "DispatchEventBase.h"
#include "Frame.h"
#include "Page.h"
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

namespace ReplayableTypes {
const char *DispatchFakeMouseMove = "DispatchFakeMouseMove";
}

DispatchFakeMouseMove::DispatchFakeMouseMove(Frame* frame, const PlatformMouseEvent& event)
    : HandleMouseBase(event, ReplayableTypes::DispatchFakeMouseMove)
    , m_frameIndex(SerializedEventTarget::frameIndexFromDocument(frame->document())) { }

//DispatchableAction API
void DispatchFakeMouseMove::dispatch(DeterminismController* controller)
{
    Document* document = SerializedEventTarget::documentFromFrameIndex(controller->page(), m_frameIndex);
    ASSERT(document);
    Frame* frame = document->frame();
    ASSERT(frame);

    controller->page()->asyncEventProxy()->dispatchFakeMouseMove(frame, platformEvent(), true);
    controller->didDispatch(this);
}

String DispatchFakeMouseMove::toString() const
{
    return makeString("DispatchFakeMouseMove(", String::number(m_frameIndex), "/_)");
}

void DispatchFakeMouseMove::serialize(ActionSerializer* serializer) const
{
    HandleMouseBase::serializeMouseInfo(serializer);
    serializer->putInt("frameIndex", m_frameIndex);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
