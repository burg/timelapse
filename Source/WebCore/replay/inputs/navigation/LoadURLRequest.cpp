/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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
#include "LoadURLRequest.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "FrameLoadRequest.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceRequest.h"
#include "SerializationMethods.h"
#include <wtf/PassOwnPtr.h>
#include <wtf/text/StringBuilder.h>

namespace WebCore {

LoadURLRequest::LoadURLRequest(const FrameLoadRequest& request)
    : m_request(adoptPtr(new FrameLoadRequest(request.requester()->isolatedCopy(), request.resourceRequest(), request.frameName(), request.substituteData())))
{
}

LoadURLRequest::LoadURLRequest(PassOwnPtr<FrameLoadRequest> request)
    : m_request(request)
{
}

LoadURLRequest::~LoadURLRequest()
{
}

void LoadURLRequest::dispatch(ReplayController& controller)
{
    controller.page().replayProxy().loadURLRequest(*m_request);
}

const AtomicString& LoadURLRequest::type() const
{
    return inputTypes().LoadURLRequest;
}

String LoadURLRequest::toString() const
{
    StringBuilder sb;
    sb.append("LoadURLRequest(requester=");
    sb.append(m_request->requester()->toString());
    sb.append("; url=");
    sb.append(m_request->resourceRequest().url().string());
    sb.append(")");
    return sb.toString();
}

size_t LoadURLRequest::memorySize() const
{
    // This is inaccurate, since we don't count the size of the request, origin, or substitute data.
    return sizeof(LoadURLRequest);
}

void InputCoder<FrameLoadRequest>::encode(EncoderContext& encoder, const FrameLoadRequest& request)
{
    encoder.put("securityOrigin", request.requester()->toString());

    std::unique_ptr<EncoderContext> encodedRequest = encoder.createMap();
    InputCoder<ResourceRequest>::encode(*encodedRequest, request.resourceRequest());
    encoder.put("resourceRequest", *encodedRequest);

    encoder.put("frameName", request.frameName());
    encoder.put("lockHistory", request.lockHistory());
    encoder.put("shouldCheckNewWindowPolicy", request.shouldCheckNewWindowPolicy());

    if (request.hasSubstituteData()) {
        std::unique_ptr<EncoderContext> encodedSubstituteData = encoder.createMap();
        InputCoder<SubstituteData>::encode(*encodedSubstituteData, request.substituteData());
        encoder.put("substituteData", *encodedSubstituteData);
    }
}

bool InputCoder<FrameLoadRequest>::decode(DecoderContext&, std::unique_ptr<FrameLoadRequest>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<LoadURLRequest>::encode(EncoderContext& encoder, const LoadURLRequest& input)
{
    std::unique_ptr<EncoderContext> encodedRequest = encoder.createMap();
    InputCoder<FrameLoadRequest>::encode(*encodedRequest, input.request());
    encoder.put("request", *encodedRequest);
}

bool InputCoder<LoadURLRequest>::decode(DecoderContext& decoder, std::unique_ptr<LoadURLRequest>& input)
{
    std::unique_ptr<FrameLoadRequest> request;
    if (!InputCoder<FrameLoadRequest>::decode(decoder, request))
        return false;

    input = std::make_unique<LoadURLRequest>(adoptPtr(request.release()));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
