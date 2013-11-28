/*
 * Copyright (C) 2012 University of Washington. All rights reserved.
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
#include "SerializationMethods.h"

#if ENABLE(WEB_REPLAY)

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "HTTPHeaderMap.h"
#include "ResourceError.h"
#include "ResourceLoadTiming.h"
#include "ResourceRequest.h"
#include "ResourceResponse.h"
#include "SubstituteData.h"
#include <wtf/Vector.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

void InputCoder<Vector<String>>::encode(EncoderContext& encoder, const Vector<String>& input)
{
    for (size_t i = 0; i < input.size(); i++)
        encoder.append(input[i]);
}

bool InputCoder<Vector<String>>::decode(DecoderContext&, std::unique_ptr<Vector<String>>&)
{
    // FIXME: implement.
    return false;
}

void InputCoder<SharedBuffer>::encode(EncoderContext& encoder, const SharedBuffer& buffer)
{
    // FIXME: this should store a base64-encoded string, rather than bytes as chars.
    // Tracking bug: https://github.com/burg/timelapse/issues/265
    std::unique_ptr<EncoderContext> encodedData = encoder.createList();
    const char* segment;
    unsigned pos = 0;
    while (unsigned length = buffer.getSomeData(segment, pos)) {
        for (size_t i = 0; i < length; i++)
            encoder.append((uint32_t)segment[i]);
        pos += length;
    }
    encoder.put("data", *encodedData);
}

bool InputCoder<SharedBuffer>::decode(DecoderContext&, std::unique_ptr<SharedBuffer>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<HTTPHeaderMap>::encode(EncoderContext& encoder, const HTTPHeaderMap& input)
{
    for (HTTPHeaderMap::const_iterator it = input.begin(); it != input.end(); ++it)
        encoder.put(it->key.string(), it->value);
}

bool InputCoder<HTTPHeaderMap>::decode(DecoderContext&, std::unique_ptr<HTTPHeaderMap>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<FormDataElement>::encode(EncoderContext& encoder, const FormDataElement& element)
{
    encoder.put("type", (uint64_t)element.m_type);
    switch (element.m_type) {
    case FormDataElement::data:
        encoder.putBytes("data", element.m_data.data(), element.m_data.size());
        break;
    case FormDataElement::encodedFile:
        encoder.put("filename", element.m_filename);
        encoder.put("shouldGenerateFile", element.m_shouldGenerateFile);
#if ENABLE(BLOB)
        encoder.put("fileStart", element.m_fileStart);
        encoder.put("fileLength", (int64_t)element.m_fileLength);
        encoder.put("expectedFileModificationTime", element.m_expectedFileModificationTime);
#endif
        break;

#if ENABLE(BLOB)
    case FormDataElement::encodedBlob:
        encoder.put("blobURL", element.m_url.string());
        break;
#endif
    }
}

bool InputCoder<FormDataElement>::decode(DecoderContext&, std::unique_ptr<FormDataElement>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<FormData>::encode(EncoderContext& encoder, const FormData& data)
{
    // This is based on FormData::encodeForBackForward, except we use key/value objects instead
    // of a byte array.

    encoder.put("alwaysStream", data.alwaysStream());
    encoder.put("identifier", data.identifier());
    encoder.putBytes("boundary", data.boundary().data(), data.boundary().size());

    std::unique_ptr<EncoderContext> encodedElements = encoder.createList();
    const Vector<FormDataElement> elems = data.elements();
    for (size_t i = 0; i < elems.size(); i++) {
        std::unique_ptr<EncoderContext> encodedElement = encoder.createMap();
        InputCoder<FormDataElement>::encode(*encodedElement, elems[i]);
        encodedElements->append(*encodedElement);
    }
    encoder.put("elements", *encodedElements);
}

bool InputCoder<FormData>::decode(DecoderContext&, std::unique_ptr<FormData>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<SubstituteData>::encode(EncoderContext& encoder, const SubstituteData& data)
{
    std::unique_ptr<EncoderContext> encodedBuffer = encoder.createMap();
    InputCoder<SharedBuffer>::encode(*encodedBuffer, *data.content());
    encoder.put("content", *encodedBuffer);

    encoder.put("mimeType", data.mimeType());
    encoder.put("textEncoding", data.textEncoding());
    encoder.put("failingURL", data.failingURL().string());
    encoder.put("responseURL", data.responseURL().string());
    encoder.put("shouldRevealToSessionHistory", data.shouldRevealToSessionHistory());
}

bool InputCoder<SubstituteData>::decode(DecoderContext&, std::unique_ptr<SubstituteData>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<ResourceLoadTiming>::encode(EncoderContext& encoder, const ResourceLoadTiming& data)
{
    encoder.put("requestTime", data.requestTime);
    encoder.put("proxyStart", data.proxyStart);
    encoder.put("proxyEnd", data.proxyEnd);
    encoder.put("dnsStart", data.dnsStart);
    encoder.put("dnsEnd", data.dnsEnd);
    encoder.put("connectStart", data.connectStart);
    encoder.put("connectEnd", data.connectEnd);
    encoder.put("sendStart", data.sendStart);
    encoder.put("sendEnd", data.sendEnd);
    encoder.put("receiveHeadersEnd", data.receiveHeadersEnd);
    encoder.put("sslStart", data.sslStart);
    encoder.put("sslEnd", data.sslEnd);
}

bool InputCoder<ResourceLoadTiming>::decode(DecoderContext&, std::unique_ptr<ResourceLoadTiming>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<ResourceError>::encode(EncoderContext& encoder, const ResourceError& error)
{
    encoder.put("domain", error.domain());
    encoder.put("errorCode", error.errorCode());
    encoder.put("failingURL", error.failingURL());
    encoder.put("localizedDescription", error.localizedDescription());
}

bool InputCoder<ResourceError>::decode(DecoderContext&, std::unique_ptr<ResourceError>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<ResourceRequest>::encode(EncoderContext& encoder, const ResourceRequest& request)
{
    encoder.put("url", request.url().string());
    encoder.put("cachePolicy", (uint64_t)request.cachePolicy());
    encoder.put("timeoutInterval", request.timeoutInterval());
    encoder.put("firstPartyForCookies", request.firstPartyForCookies().string());
    encoder.put("httpMethod", request.httpMethod());

    std::unique_ptr<EncoderContext> encodedHeaders = encoder.createMap();
    InputCoder<HTTPHeaderMap>::encode(*encodedHeaders, request.httpHeaderFields());
    encoder.put("httpHeaders", *encodedHeaders);

    std::unique_ptr<EncoderContext> encodedFallbackArray = encoder.createList();
    InputCoder<Vector<String>>::encode(*encodedFallbackArray, request.responseContentDispositionEncodingFallbackArray());
    encoder.put("responseContentDispositionEncodingFallbackArray", *encodedFallbackArray);

    // Sometimes, there's no form data.
    if (FormData* body = request.httpBody()) {
        std::unique_ptr<EncoderContext> encodedFormData = encoder.createMap();
        InputCoder<FormData>::encode(*encodedFormData, *body);
        encoder.put("httpBody", *encodedFormData);
    }

    encoder.put("allowCookies", request.allowCookies());
    encoder.put("loadPriority", (uint64_t)request.priority());
}

bool InputCoder<ResourceRequest>::decode(DecoderContext&, std::unique_ptr<ResourceRequest>&)
{
    // FIXME: implement
    return false;
}

void InputCoder<ResourceResponse>::encode(EncoderContext& encoder, const ResourceResponse& response)
{
    encoder.put("url", response.url().string());
    encoder.put("mimeType", response.mimeType());
    encoder.put("expectedContentLength", (int64_t)response.expectedContentLength());
    encoder.put("textEncodingName", response.textEncodingName());
    encoder.put("suggestedFilename", response.suggestedFilename());
    encoder.put("httpStatusCode", response.httpStatusCode());
    encoder.put("httpStatusText", response.httpStatusText());

    std::unique_ptr<EncoderContext> encodedHeaders = encoder.createMap();
    InputCoder<HTTPHeaderMap>::encode(*encodedHeaders, response.httpHeaderFields());
    encoder.put("httpHeaders", *encodedHeaders);

    encoder.put("lastModifiedDate", (uint64_t)response.lastModified());

    if (ResourceLoadTiming* data = response.resourceLoadTiming()) {
        std::unique_ptr<EncoderContext> encodedLoadTimings = encoder.createMap();
        InputCoder<ResourceLoadTiming>::encode(*encodedLoadTimings, *data);
        encoder.put("loadTiming", *encodedLoadTimings);
    }
}

bool InputCoder<ResourceResponse>::decode(DecoderContext&, std::unique_ptr<ResourceResponse>&)
{
    // FIXME: implement
    return false;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
