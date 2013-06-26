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

#if ENABLE(TIMELAPSE)

#include "ResourceWillSendRequest.h"

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
#include "InputEncoder.h"

namespace WebCore {

ResourceWillSendRequest::ResourceWillSendRequest(int id, ResourceRequest& request, const ResourceResponse& redirectResponse)
    : m_id(id)
    , m_request(ResourceRequest::adopt(request.copyData()))
    , m_redirectResponse(ResourceResponse::adopt(redirectResponse.copyData())) {}

ResourceWillSendRequest::~ResourceWillSendRequest() {}

//EventLoopInput API
void ResourceWillSendRequest::dispatch(ReplayController* controller,
                                       EventLoopInputDispatcher* dispatcher)
{
    HandleContext context = controller->page()->networkProxy()->handleContextById(m_id);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->willSendRequest(handle.get(), *m_request, *m_redirectResponse);
    dispatcher->didDispatch(this);
}

const AtomicString& ResourceWillSendRequest::type() const
{
    return inputTypes().ResourceWillSendRequest;
}

String ResourceWillSendRequest::toString() const
{
    StringBuilder sb;
    sb.append("ResourceWillSendRequest(id=");
    sb.append(String::number(m_id));
    sb.append("; url=");
    sb.append(m_request->url().string());
    sb.append(")");
    return sb.toString();
}

size_t ResourceWillSendRequest::memorySize() const
{
    return sizeof(ResourceWillSendRequest) + 2 * m_redirectResponse->memoryUsage();
}

void ResourceWillSendRequest::serialize(InputEncoder& encoder) const
{
    encoder.put("handleId", m_id);

    encoder.pushObject();
    serializeResourceRequest(encoder, m_request.get());
    encoder.popObjectAsProperty("request");

    encoder.pushObject();
    serializeResourceResponse(encoder, m_redirectResponse.get());
    encoder.popObjectAsProperty("redirectResponse");
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
