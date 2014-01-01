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
#include "ResourceDidFinishLoading.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceLoader.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidFinishLoading::ResourceDidFinishLoading(unsigned long identifier, int frameIndex, double finishTime)
    : ResourceCallback(identifier, frameIndex)
    , m_finishTime(finishTime)
{
}

void ResourceDidFinishLoading::dispatch(ReplayController& controller)
{
    if (ResourceLoader* loader = findResourceLoader(controller))
        loader->didFinishLoading(m_finishTime);
}

const AtomicString& ResourceDidFinishLoading::type() const
{
    return inputTypes().ResourceDidFinishLoading;
}

String ResourceDidFinishLoading::toString() const
{
    StringBuilder builder;
    builder.appendLiteral("ResourceDidFinishLoading(id=");
    builder.appendNumber(identifier());
    builder.appendLiteral("; finishTime=");
    builder.appendNumber(m_finishTime);
    builder.appendLiteral(")");
    return builder.toString();
}

void InputCoder<ResourceDidFinishLoading>::encode(EncoderContext& encoder, const ResourceDidFinishLoading& input)
{
    encoder.put("identifier", input.identifier());
    encoder.put("frameIndex", input.frameIndex());
    encoder.put("finishTime", input.finishTime());
}

bool InputCoder<ResourceDidFinishLoading>::decode(DecoderContext& decoder, std::unique_ptr<ResourceDidFinishLoading>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    double finishTime;
    if (!decoder.get("finishTime", finishTime))
        return false;

    input = std::make_unique<ResourceDidFinishLoading>(identifier, frameIndex, finishTime);
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

