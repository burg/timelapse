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

#include "ResourceLoaderDestroyed.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "NetworkProxy.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"

namespace WebCore {

ResourceLoaderDestroyed::ResourceLoaderDestroyed(unsigned long identifier)
    : m_identifier(identifier) {}

void ResourceLoaderDestroyed::dispatch(ReplayController& controller)
{
    controller.page().networkProxy().removeHandleByIdentifier(m_identifier);
}

const AtomicString& ResourceLoaderDestroyed::type() const
{
    return inputTypes().ResourceLoaderDestroyed;
}

String ResourceLoaderDestroyed::toString() const
{
    return makeString("ResourceLoaderDestroyed(id=", String::number(m_identifier), ")");
}

size_t ResourceLoaderDestroyed::memorySize() const
{
    return sizeof(ResourceLoaderDestroyed);
}

void InputCoder<ResourceLoaderDestroyed>::encode(EncoderContext& encoder, const ResourceLoaderDestroyed& input)
{
    encoder.put("identifier", input.identifier());
}

bool InputCoder<ResourceLoaderDestroyed>::decode(DecoderContext& decoder, std::unique_ptr<ResourceLoaderDestroyed>& input)
{
    unsigned long identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    input = std::make_unique<ResourceLoaderDestroyed>(identifier);
    return true;
}


} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
