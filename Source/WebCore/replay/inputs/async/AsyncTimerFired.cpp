/*
 * Copyright (C) 2011 University of Washington. All rights reserved.
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
#include "AsyncTimerFired.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "Document.h"
#include "EncoderContext.h"
#include "Page.h"
#include "ReplayableTimers.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

AsyncTimerFired::AsyncTimerFired(int frameIndex, unsigned int identifier)
    : m_frameIndex(frameIndex)
    , m_identifier(identifier)
{
}

const AtomicString& AsyncTimerFired::type() const
{
    return inputTypes().AsyncTimerFired;
}

String AsyncTimerFired::toString() const
{
    return makeString("AsyncTimerFired(", String::number(m_frameIndex), "/", String::number(m_identifier), ")");
}

void AsyncTimerFired::dispatch(ReplayController& controller)
{
    Document* document = documentFromFrameIndex(&controller.page(), m_frameIndex);
    if (!document || !document->replayableTimers().fireTimer(m_identifier))
        LOG_ERROR("%-30s REPLAY DIVERGENCE! Couldn't find async timer %d/%u.\n", "[ReplayController]", m_frameIndex, m_identifier);
}

void InputCoder<AsyncTimerFired>::encode(EncoderContext& encoder, const AsyncTimerFired& input)
{
    encoder.put("frameIndex", input.frameIndex());
    encoder.put("identifier", input.identifier());
}

bool InputCoder<AsyncTimerFired>::decode(DecoderContext& decoder, std::unique_ptr<AsyncTimerFired>& input)
{
    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    unsigned int identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    input = std::make_unique<AsyncTimerFired>(frameIndex, identifier);
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
