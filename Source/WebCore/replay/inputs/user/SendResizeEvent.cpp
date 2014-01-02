/*
 * Copyright (C) 2012 Jake Bailey.
 * Copyright (C) 2012 University of Washington. All rights reserved.
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
#include "SendResizeEvent.h"

#if ENABLE(WEB_REPLAY)

#include "DOMWindow.h"
#include "DecoderContext.h"
#include "Document.h"
#include "EncoderContext.h"
#include "Frame.h"
#include "Page.h"
#include "ReplayController.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

SendResizeEvent::SendResizeEvent(int width, int height, int frameIndex)
    : m_width(width)
    , m_height(height)
    , m_frameIndex(frameIndex)
{
}

void SendResizeEvent::dispatch(ReplayController& controller)
{
    Document* document = documentFromFrameIndex(&controller.page(), m_frameIndex);
    document->domWindow()->resizeTo((float) m_width, (float) m_height);
    controller.page().replayProxy().sendResizeEvent(document->frame(), true);
}

const AtomicString& SendResizeEvent::type() const
{
    return inputTypes().SendResizeEvent;
}

void InputCoder<SendResizeEvent>::encode(EncoderContext& encoder, const SendResizeEvent& input)
{
    encoder.put("width", input.width());
    encoder.put("height", input.height());
    encoder.put("frameIndex", input.frameIndex());
}

bool InputCoder<SendResizeEvent>::decode(DecoderContext& decoder, std::unique_ptr<SendResizeEvent>& input)
{
    int width;
    if (!decoder.get("width", width))
        return false;

    int height;
    if (!decoder.get("height", height))
        return false;

    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    input = std::make_unique<SendResizeEvent>(width, height, frameIndex);
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
