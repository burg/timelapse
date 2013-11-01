/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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

#if ENABLE(WEB_REPLAY)

#include "ResourceDidReceiveResponse.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceLoader.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidReceiveResponse::ResourceDidReceiveResponse(unsigned long identifier, int frameIndex, const ResourceResponse& response)
    : ResourceCallback(identifier, frameIndex)
    , m_response(ResourceResponse::adopt(response.copyData())) {}

ResourceDidReceiveResponse::ResourceDidReceiveResponse(unsigned long identifier, int frameIndex, std::unique_ptr<ResourceResponse> response)
    : ResourceCallback(identifier, frameIndex)
    , m_response(adoptPtr(response.release())) {}

void ResourceDidReceiveResponse::dispatch(ReplayController& controller)
{
    if (ResourceLoader* loader = findResourceLoader(controller))
        loader->didReceiveResponse(*m_response);
}

const AtomicString& ResourceDidReceiveResponse::type() const
{
    return inputTypes().ResourceDidReceiveResponse;
}

String ResourceDidReceiveResponse::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidReceiveResponse(id=");
    sb.append(String::number(identifier()));
    sb.append("; frameIndex=");
    sb.append(String::number(frameIndex()));
    sb.append("; url=");
    sb.append(m_response->url().string());
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidReceiveResponse::memorySize() const
{
    return sizeof(ResourceDidReceiveResponse) + m_response->memoryUsage();
}

void InputCoder<ResourceDidReceiveResponse>::encode(EncoderContext& encoder, const ResourceDidReceiveResponse& input)
{
    encoder.put("identifier", input.identifier());
    encoder.put("frameIndex", input.frameIndex());

    std::unique_ptr<EncoderContext> encodedResponse = encoder.createMap();
    InputCoder<ResourceResponse>::encode(*encodedResponse, input.response());
    encoder.put("response", *encodedResponse);
}

bool InputCoder<ResourceDidReceiveResponse>::decode(DecoderContext& decoder, std::unique_ptr<ResourceDidReceiveResponse>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    std::unique_ptr<ResourceResponse> response;
    if (!InputCoder<ResourceResponse>::decode(decoder, response))
        return false;

    input = std::make_unique<ResourceDidReceiveResponse>(identifier, frameIndex, std::move(response));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
