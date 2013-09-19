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

#include "ResourceLoaderCreated.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceRequest.h"
#include "SerializationMethods.h"

namespace WebCore {

ResourceLoaderCreated::ResourceLoaderCreated(int handleId, const ResourceRequest& request)
    : m_handleId(handleId)
    , m_request(ResourceRequest::adopt(request.copyData())) {}

ResourceLoaderCreated::ResourceLoaderCreated(int handleId, PassOwnPtr<ResourceRequest> request)
    : m_handleId(handleId)
    , m_request(request) {}

ResourceLoaderCreated::~ResourceLoaderCreated()
{
    m_request = 0;
}

// NondeterministicInput API

const AtomicString& ResourceLoaderCreated::type() const
{
    return inputTypes().ResourceLoaderCreated;
}

String ResourceLoaderCreated::toString() const
{
    return makeString("ResourceLoaderCreated(handleId=",
                      String::number(m_handleId),
                      "; url=",
                      m_request->url().string(),
                      ")");
}

size_t ResourceLoaderCreated::memorySize() const
{
    // see ResourceResponse::memoryUsage();
    return sizeof(ResourceLoaderCreated) + 1280 + 256;
}

void InputCoder<ResourceLoaderCreated>::encode(EncoderContext& encoder, const ResourceLoaderCreated& input)
{
    encoder.put("handleId", input.handleId());

    OwnPtr<EncoderContext> encodedRequest = encoder.createMap();
    InputCoder<ResourceRequest>::encode(*encodedRequest, input.request());
    encoder.put("request", *encodedRequest);
}

bool InputCoder<ResourceLoaderCreated>::decode(DecoderContext& decoder, OwnPtr<ResourceLoaderCreated>& input)
{
    int handleId;
    if (!decoder.get("handleId", handleId))
        return false;

    OwnPtr<ResourceRequest> request;
    if (!InputCoder<ResourceRequest>::decode(decoder, request))
        return false;

    input = adoptPtr(new ResourceLoaderCreated(handleId, request.release()));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

