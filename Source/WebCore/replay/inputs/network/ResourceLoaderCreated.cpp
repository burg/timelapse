/*
 *  Copyright (C) 2012 University of Washington. All rights reserved.
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
#include "ResourceLoaderCreated.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceRequest.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceLoaderCreated::ResourceLoaderCreated(unsigned long identifier, const ResourceRequest& request)
    : m_identifier(identifier)
    , m_request(ResourceRequest::adopt(request.copyData()))
{
}

ResourceLoaderCreated::ResourceLoaderCreated(unsigned long identifier, std::unique_ptr<ResourceRequest> request)
    : m_identifier(identifier)
    , m_request(adoptPtr(request.release()))
{
}

ResourceLoaderCreated::~ResourceLoaderCreated()
{
    m_request = nullptr;
}

// NondeterministicInput API

const AtomicString& ResourceLoaderCreated::type() const
{
    return inputTypes().ResourceLoaderCreated;
}

String ResourceLoaderCreated::toString() const
{
    StringBuilder builder;
    builder.appendLiteral("ResourceLoaderCreated(identifier=");
    builder.appendNumber(m_identifier);
    builder.appendLiteral("; url=");
    builder.append(m_request->url().string());
    builder.appendLiteral(")");
    return builder.toString();
}

void InputCoder<ResourceLoaderCreated>::encode(EncoderContext& encoder, const ResourceLoaderCreated& input)
{
    encoder.put("identifier", input.identifier());

    std::unique_ptr<EncoderContext> encodedRequest = encoder.createMap();
    InputCoder<ResourceRequest>::encode(*encodedRequest, input.request());
    encoder.put("request", *encodedRequest);
}

bool InputCoder<ResourceLoaderCreated>::decode(DecoderContext& decoder, std::unique_ptr<ResourceLoaderCreated>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    std::unique_ptr<ResourceRequest> request;
    if (!InputCoder<ResourceRequest>::decode(decoder, request))
        return false;

    input = std::make_unique<ResourceLoaderCreated>(identifier, std::move(request));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

