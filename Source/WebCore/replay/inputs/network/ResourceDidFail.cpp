/*
 * Copyright (C) 2012, University of Washington. All rights reserved.
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
#include "ResourceDidFail.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceLoader.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidFail::ResourceDidFail(unsigned long identifier, int frameIndex, const ResourceError& error)
    : ResourceCallback(identifier, frameIndex)
    , m_error(error.copy())
{
}

ResourceDidFail::ResourceDidFail(unsigned long identifier, int frameIndex, std::unique_ptr<ResourceError> error)
    : ResourceCallback(identifier, frameIndex)
    , m_error(*error)
{
}

void ResourceDidFail::dispatch(ReplayController& controller)
{
    if (ResourceLoader* loader = findResourceLoader(controller))
        loader->didFail(m_error.copy());
}

const AtomicString& ResourceDidFail::type() const
{
    return inputTypes().ResourceDidFail;
}

String ResourceDidFail::toString() const
{
    StringBuilder sb;
    sb.appendLiteral("ResourceDidFail(id=");
    sb.appendNumber(identifier());
    sb.appendLiteral(";domain=");
    sb.append(m_error.domain());
    sb.appendLiteral(";failingURL=");
    sb.append(m_error.failingURL());
    sb.appendLiteral(";errorCode=");
    sb.appendNumber(m_error.errorCode());
    sb.appendLiteral(";localizedDescription=");
    sb.append(m_error.localizedDescription());
    sb.appendLiteral(")");
    return sb.toString();
}

void InputCoder<ResourceDidFail>::encode(EncoderContext& encoder, const ResourceDidFail& input)
{
    encoder.put("identifier", input.identifier());
    encoder.put("frameIndex", input.frameIndex());

    std::unique_ptr<EncoderContext> encodedError = encoder.createMap();
    InputCoder<ResourceError>::encode(*encodedError, input.error());
    encoder.put("error", *encodedError);
}

bool InputCoder<ResourceDidFail>::decode(DecoderContext& decoder, std::unique_ptr<ResourceDidFail>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    std::unique_ptr<ResourceError> error;
    if (!InputCoder<ResourceError>::decode(decoder, error))
        return false;

    input = std::make_unique<ResourceDidFail>(identifier, frameIndex, std::move(error));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
