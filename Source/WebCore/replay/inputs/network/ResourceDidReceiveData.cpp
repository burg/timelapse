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

#include "ResourceDidReceiveData.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"

namespace WebCore {

ResourceDidReceiveData::ResourceDidReceiveData(int handleId, const char* data, int length, int encodedLength)
    : m_handleId(handleId)
    , m_buffer(Vector<char,0>())
    , m_encodedLength(encodedLength)
{
    m_buffer.append(data, length);
}

ResourceDidReceiveData::~ResourceDidReceiveData() {}

//EventLoopInput API
void ResourceDidReceiveData::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    HandleContext context = controller.page()->networkProxy().handleContextById(handleId());
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;

    client->didReceiveData(handle.get(), data(), length(), encodedLength());
    dispatcher.didDispatch(this);
}

const AtomicString& ResourceDidReceiveData::type() const
{
    return inputTypes().ResourceDidReceiveData;
}

String ResourceDidReceiveData::toString() const
{
    return makeString("ResourceDidReceiveData(id=",
                      String::number(handleId()),
                      ";bytes=",
                      String::number(length()),
                      ")");
}

size_t ResourceDidReceiveData::memorySize() const
{
    return sizeof(ResourceDidReceiveData) + m_buffer.size();
}

void InputCoder<ResourceDidReceiveData>::encode(EncoderContext& encoder, const ResourceDidReceiveData& input)
{
    encoder.put("handleId", input.handleId());
    encoder.put("length", input.length());
    encoder.put("encodedLength", input.encodedLength());
    encoder.putBytes("data", input.data(), input.length());
}

bool InputCoder<ResourceDidReceiveData>::decode(DecoderContext&, OwnPtr<ResourceDidReceiveData>&)
{
    // TODO: implement
    return false;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
