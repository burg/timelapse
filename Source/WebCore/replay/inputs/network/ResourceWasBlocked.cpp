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

#include "ResourceWasBlocked.h"

#include "InputDecoder.h"
#include "InputEncoder.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"

namespace WebCore {

ResourceWasBlocked::ResourceWasBlocked(int handleId)
    : m_handleId(handleId) {}

//EventLoopInput API
void ResourceWasBlocked::dispatch(ReplayController* controller,
                                  EventLoopInputDispatcher* dispatcher)
{
    HandleContext context = controller->page()->networkProxy()->handleContextById(m_handleId);
    RefPtr<ResourceHandle> handle = context.first;
    ResourceHandleClient* client = context.second;
    client->cannotShowURL(handle.get());

    dispatcher->didDispatch(this);
}

const AtomicString& ResourceWasBlocked::type() const
{
    return inputTypes().ResourceWasBlocked;
}

String ResourceWasBlocked::toString() const
{
    return makeString("ResourceWasBlocked(id=", String::number(m_handleId), ")");
}

size_t ResourceWasBlocked::memorySize() const
{
    return sizeof(ResourceWasBlocked);
}

void InputCoder<ResourceWasBlocked>::encode(InputEncoder& encoder, const ResourceWasBlocked& input)
{
    encoder.put("handleId", input.handleId());
}

bool InputCoder<ResourceWasBlocked>::decode(InputDecoder& decoder, OwnPtr<ResourceWasBlocked>& input)
{
    int handleId;
    if (!decoder.get("handleId", handleId))
        return false;

    input = adoptPtr(new ResourceWasBlocked(handleId));
    return true;
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
