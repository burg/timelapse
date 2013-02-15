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

#include "DeterminismController.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "ResourceRequest.h"
#include "ResourceResponse.h"
#include "SerializationMethods.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

namespace ReplayableTypes {
const char *ResourceWillSendRequest = "ResourceWillSendRequest";
}

ResourceWillSendRequest::ResourceWillSendRequest(int id, ResourceRequest& request, const ResourceResponse& redirectResponse)
    : DispatchableAction(ReplayableTypes::ResourceWillSendRequest)
    , m_id(id)
    , m_request(ResourceRequest::adopt(request.copyData()))
    , m_redirectResponse(ResourceResponse::adopt(redirectResponse.copyData())) {}

//DispatchableAction API
void ResourceWillSendRequest::dispatch(DeterminismController* controller)
{
    HandleContext context = controller->page()->networkProxy()->handleContextById(m_id);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->willSendRequest(handle.get(), *m_request, *m_redirectResponse);
    controller->didDispatch(this);
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

void ResourceWillSendRequest::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("handleId", m_id);

    serializer->pushObject();
    serializeResourceRequest(serializer, m_request.get());
    serializer->popObjectAsProperty("request");
    
    serializer->pushObject();
    serializeResourceResponse(serializer, m_redirectResponse.get());
    serializer->popObjectAsProperty("redirectResponse");
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
