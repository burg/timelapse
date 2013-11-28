/*
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
#include "InitializeFocus.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "Document.h"
#include "EncoderContext.h"
#include "FocusController.h"
#include "Frame.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

void InitializeFocus::dispatch(ReplayController& controller)
{
    Document* document = documentFromFrameIndex(&controller.page(), m_frameIndex);
    RefPtr<Frame> frame(document->frame());

    // Setting active/focus is idempotent, so set it whether or not it needs to be set.
    controller.page().replayProxy().focusSetActive(m_active, true);
    controller.page().replayProxy().focusSetFocused(m_focus, true);
    controller.page().focusController().setFocusedFrame(frame);
}

const AtomicString& InitializeFocus::type() const
{
    return inputTypes().InitializeFocus;
}

String InitializeFocus::toString() const
{
    StringBuilder builder;
    builder.appendLiteral("InitializeFocus(focus=");
    builder.append(m_focus ? "true" : "false");
    builder.appendLiteral("; active=");
    builder.append(m_active ? "true" : "false");
    builder.appendLiteral("; frameIndex=");
    builder.appendNumber(m_frameIndex);
    builder.appendLiteral(")");
    return builder.toString();
}

std::unique_ptr<InitializeFocus> InitializeFocus::createFromPage(const Page& page)
{
    int focusedFrameIndex = frameIndexFromDocument(page.focusController().focusedFrame()->document());
    bool isFocused = page.focusController().isFocused();
    bool isActive = page.focusController().isActive();
    return std::make_unique<InitializeFocus>(focusedFrameIndex, isFocused, isActive);
}

void InputCoder<InitializeFocus>::encode(EncoderContext& encoder, const InitializeFocus& input)
{
    encoder.put("active", input.isActive());
    encoder.put("focused", input.isFocused());
    encoder.put("frameIndex", input.frameIndex());
}

bool InputCoder<InitializeFocus>::decode(DecoderContext& decoder, std::unique_ptr<InitializeFocus>& input)
{
    bool isActive;
    if (!decoder.get("active", isActive))
        return false;

    bool isFocused;
    if (!decoder.get("focused", isFocused))
        return false;

    int focusedFrameIndex;
    if (!decoder.get("frameIndex", focusedFrameIndex))
        return false;

    input = std::make_unique<InitializeFocus>(focusedFrameIndex, isFocused, isActive);
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
