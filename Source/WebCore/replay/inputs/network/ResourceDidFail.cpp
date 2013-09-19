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

#include "ResourceDidFail.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ReplayInputTypes.h"
#include "ReplayController.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "SerializationMethods.h"
#include <wtf/OwnPtr.h>
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidFail::ResourceDidFail(int handleId, const ResourceError& error)
    : m_handleId(handleId)
    , m_error(error.copy()) {}

ResourceDidFail::ResourceDidFail(int handleId, PassOwnPtr<ResourceError> error)
    : m_handleId(handleId)
    , m_error(*error) {}

// EventLoopInput API
void ResourceDidFail::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    HandleContext context = controller.page()->networkProxy().handleContextById(m_handleId);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->didFail(handle.get(), m_error.copy());
    dispatcher.didDispatch(this);
}

const AtomicString& ResourceDidFail::type() const
{
    return inputTypes().ResourceDidFail;
}

String ResourceDidFail::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidFail(id=");
    sb.append(String::number(m_handleId));
    sb.append(";domain=");
    sb.append(m_error.domain());
    sb.append(";failingURL=");
    sb.append(m_error.failingURL());
    sb.append(";errorCode=");
    sb.append(String::number(m_error.errorCode()));
    sb.append(";localizedDescription=");
    sb.append(m_error.localizedDescription());
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidFail::memorySize() const
{
    size_t size = sizeof(ResourceDidFail);
    size += (!m_error.domain().isEmpty()) ? m_error.domain().impl()->cost() : 0;
    size += (!m_error.failingURL().isEmpty()) ? m_error.failingURL().impl()->cost() : 0;
    size += (!m_error.localizedDescription().isEmpty()) ? m_error.localizedDescription().impl()->cost() : 0;
    return size;
}

void InputCoder<ResourceDidFail>::encode(EncoderContext& encoder, const ResourceDidFail& input)
{
    encoder.put("handleId", input.handleId());

    OwnPtr<EncoderContext> encodedError = encoder.createMap();
    InputCoder<ResourceError>::encode(*encodedError, input.error());
    encoder.put("error", *encodedError);
}

bool InputCoder<ResourceDidFail>::decode(DecoderContext& decoder, OwnPtr<ResourceDidFail>& input)
{
    int handleId;
    if (!decoder.get("handleId", handleId))
        return false;

    OwnPtr<ResourceError> error;
    if (!InputCoder<ResourceError>::decode(decoder, error))
        return false;

    input = adoptPtr(new ResourceDidFail(handleId, error.release()));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
