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

#include "ResourceDidReceiveResponse.h"

#include "DeterminismController.h"
#include "InspectorInstrumentation.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "SerializationMethods.h"
#include <wtf/timelapse/ActionSerializer.h>
#include <wtf/text/StringBuilder.h>

namespace WebCore {

namespace ReplayableTypes {
const char *ResourceDidReceiveResponse = "ResourceDidReceiveResponse";
}

ResourceDidReceiveResponse::ResourceDidReceiveResponse(int id, const ResourceResponse& response)
    : DispatchableAction(ReplayableTypes::ResourceDidReceiveResponse)
    , m_id(id)
    , m_response(ResourceResponse::adopt(response.copyData())) {}

//DispatchableAction API
void ResourceDidReceiveResponse::dispatch(DeterminismController* controller)
{
    HandleContext context = controller->page()->networkProxy()->handleContextById(m_id);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;
    
    if (!client) {
        // FIXME: this shouldn't be fatal error, because we can just not deliver the callback.
        controller->playbackError(true,
                                  String::format("Couldn't find handle context for id: %d", m_id));
        return;
    }
    
    client->didReceiveResponse(handle.get(), *m_response);
    controller->didDispatch(this);
}

String ResourceDidReceiveResponse::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidReceiveResponse(id=");
    sb.append(String::number(m_id));
    sb.append("; url=");
    sb.append(m_response->url().string());
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidReceiveResponse::memorySize() const
{
    return sizeof(ResourceDidReceiveResponse) + m_response->memoryUsage();
}

void ResourceDidReceiveResponse::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("handleId", m_id);

    serializer->pushObject();
    serializeResourceResponse(serializer, m_response.get());
    serializer->popObjectAsProperty("response");
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
