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

#include "ResourceDidReceiveResponse.h"

#include "InputDecoder.h"
#include "InputEncoder.h"
#include "InspectorInstrumentation.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidReceiveResponse::ResourceDidReceiveResponse(int handleId, const ResourceResponse& response)
    : m_handleId(handleId)
    , m_response(ResourceResponse::adopt(response.copyData())) {}

ResourceDidReceiveResponse::ResourceDidReceiveResponse(int handleId, PassOwnPtr<ResourceResponse> response)
    : m_handleId(handleId)
    , m_response(response) {}

//EventLoopInput API
void ResourceDidReceiveResponse::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    HandleContext context = controller.page()->networkProxy().handleContextById(m_handleId);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    if (!client) {
        // FIXME: this shouldn't be fatal error, because we can just not deliver the callback.
        controller.playbackError(true, String::format("Couldn't find handle context for id: %d", m_handleId));
        return;
    }

    client->didReceiveResponse(handle.get(), *m_response);
    dispatcher.didDispatch(this);
}

const AtomicString& ResourceDidReceiveResponse::type() const
{
    return inputTypes().ResourceDidReceiveResponse;
}

String ResourceDidReceiveResponse::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidReceiveResponse(id=");
    sb.append(String::number(m_handleId));
    sb.append("; url=");
    sb.append(m_response->url().string());
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidReceiveResponse::memorySize() const
{
    return sizeof(ResourceDidReceiveResponse) + m_response->memoryUsage();
}

void InputCoder<ResourceDidReceiveResponse>::encode(InputEncoder& encoder, const ResourceDidReceiveResponse& input)
{
    encoder.put("handleId", input.handleId());

    encoder.pushObject();
    InputCoder<ResourceResponse>::encode(encoder, input.response());
    encoder.popObjectAsProperty("response");
}

bool InputCoder<ResourceDidReceiveResponse>::decode(InputDecoder& decoder, OwnPtr<ResourceDidReceiveResponse>& input)
{
    int handleId;
    if (!decoder.get("handleId", handleId))
        return false;

    OwnPtr<ResourceResponse> response;
    if (!InputCoder<ResourceResponse>::decode(decoder, response))
        return false;

    input = adoptPtr(new ResourceDidReceiveResponse(handleId, response.release()));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
