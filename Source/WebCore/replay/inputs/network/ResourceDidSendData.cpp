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

#include "ResourceDidSendData.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ResourceLoader.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

ResourceDidSendData::ResourceDidSendData(unsigned long identifier, int frameIndex, unsigned long long bytesSent, unsigned long long totalBytesToBeSent)
    : ResourceCallback(identifier, frameIndex)
    , m_bytesSent(bytesSent)
    , m_totalBytesToBeSent(totalBytesToBeSent) {}

void ResourceDidSendData::dispatch(ReplayController& controller)
{
    if (ResourceLoader* loader = findResourceLoader(controller))
        loader->didSendData(m_bytesSent, m_totalBytesToBeSent);
}

const AtomicString& ResourceDidSendData::type() const
{
    return inputTypes().ResourceDidSendData;
}

String ResourceDidSendData::toString() const
{
    StringBuilder sb;
    sb.append("ResourceDidSendData(id=");
    sb.append(String::number(identifier()));
    sb.append(";bytesSent=");
    sb.append(String::number(m_bytesSent));
    sb.append(")");
    return sb.toString();
}

size_t ResourceDidSendData::memorySize() const
{
    return sizeof(ResourceDidSendData);
}

void InputCoder<ResourceDidSendData>::encode(EncoderContext& encoder, const ResourceDidSendData& input)
{
    encoder.put("identifier", input.identifier());
    encoder.put("frameIndex", input.frameIndex());
    encoder.put("bytesSent", input.bytesSent());
    encoder.put("totalBytesToBeSent", input.totalBytesToBeSent());
}

bool InputCoder<ResourceDidSendData>::decode(DecoderContext& decoder, std::unique_ptr<ResourceDidSendData>& input)
{
    int identifier;
    if (!decoder.get("identifier", identifier))
        return false;

    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    uint64_t bytesSent;
    if (!decoder.get("bytesSent", bytesSent))
        return false;

    uint64_t totalBytesToBeSent;
    if (!decoder.get("totalBytesToBeSent", totalBytesToBeSent))
        return false;

    input = std::make_unique<ResourceDidSendData>(identifier, frameIndex, bytesSent, totalBytesToBeSent);
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
