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

#include "ResourceDidSendData.h"

#include "DeterminismController.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

namespace ReplayableTypes {
const char *ResourceDidSendData = "ResourceDidSendData";
}

ResourceDidSendData::ResourceDidSendData(int id, unsigned long long bytesSent, unsigned long long totalBytesToBeSent)
    : DispatchableAction(ReplayableTypes::ResourceDidSendData)
    , m_id(id)
    , m_bytesSent(bytesSent)
    , m_totalBytesToBeSent(totalBytesToBeSent) {}

//DispatchableAction API
void ResourceDidSendData::dispatch(DeterminismController* controller)
{
    HandleContext context = controller->page()->networkProxy()->handleContextById(m_id);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->didSendData(handle.get(), m_bytesSent, m_totalBytesToBeSent);
    controller->didDispatch(this);
}

String ResourceDidSendData::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidSendData(id=");
    sb.append(String::number(m_id));
    sb.append(";bytesSent=");
    sb.append(String::number(m_bytesSent));
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidSendData::memorySize() const
{
    return sizeof(ResourceDidSendData);
}

void ResourceDidSendData::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("handleId", m_id);
    serializer->putDouble("bytesSent", m_bytesSent);
    serializer->putDouble("totalBytesToBeSent", m_totalBytesToBeSent);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
