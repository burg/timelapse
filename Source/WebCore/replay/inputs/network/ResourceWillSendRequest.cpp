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

#if ENABLE(WEB_REPLAY)

#include "ResourceWillSendRequest.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "ResourceRequest.h"
#include "ResourceResponse.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/PassOwnPtr.h>

namespace WebCore {

ResourceWillSendRequest::ResourceWillSendRequest(unsigned long identifier, ResourceRequest& request, const ResourceResponse& redirectResponse)
    : m_identifier(identifier)
    , m_request(ResourceRequest::adopt(request.copyData()))
    , m_redirectResponse(ResourceResponse::adopt(redirectResponse.copyData())) {}

ResourceWillSendRequest::ResourceWillSendRequest(unsigned long identifier, std::unique_ptr<ResourceRequest> request, std::unique_ptr<ResourceResponse> redirectResponse)
    : m_identifier(identifier)
    , m_request(adoptPtr(request.release()))
    , m_redirectResponse(adoptPtr(redirectResponse.release())) {}

ResourceWillSendRequest::~ResourceWillSendRequest() {}

void ResourceWillSendRequest::dispatch(ReplayController& controller)
{
    HandleContext context = controller.page().networkProxy().handleContextByIdentifier(m_identifier);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->willSendRequest(handle.get(), *m_request, *m_redirectResponse);
}

const AtomicString& ResourceWillSendRequest::type() const
{
    return inputTypes().ResourceWillSendRequest;
}

String ResourceWillSendRequest::toString() const
{
    StringBuilder sb;
    sb.append("ResourceWillSendRequest(id=");
    sb.append(String::number(m_identifier));
    sb.append("; url=");
    sb.append(m_request->url().string());
    sb.append(")");
    return sb.toString();
}

size_t ResourceWillSendRequest::memorySize() const
{
    return sizeof(ResourceWillSendRequest) + 2 * m_redirectResponse->memoryUsage();
}

void InputCoder<ResourceWillSendRequest>::encode(EncoderContext& encoder, const ResourceWillSendRequest& input)
{
    encoder.put("identifier", input.identifier());

    std::unique_ptr<EncoderContext> encodedRequest = encoder.createMap();
    InputCoder<ResourceRequest>::encode(*encodedRequest, input.request());
    encoder.put("request", *encodedRequest);

    std::unique_ptr<EncoderContext> encodedResponse = encoder.createMap();
    InputCoder<ResourceResponse>::encode(*encodedResponse, input.redirectResponse());
    encoder.put("redirectResponse", *encodedResponse);
}

bool InputCoder<ResourceWillSendRequest>::decode(DecoderContext& decoder, std::unique_ptr<ResourceWillSendRequest>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    std::unique_ptr<ResourceRequest> request;
    if (!InputCoder<ResourceRequest>::decode(decoder, request))
        return false;

    std::unique_ptr<ResourceResponse> redirectResponse;
    if (!InputCoder<ResourceResponse>::decode(decoder, redirectResponse))
        return false;

    input = std::make_unique<ResourceWillSendRequest>(identifier, std::move(request), std::move(redirectResponse));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
