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

#include "SerializationMethods.h"

#include "HTTPHeaderMap.h"
#include "InputDecoder.h"
#include "InputEncoder.h"
#include "ResourceError.h"
#include "ResourceLoadTiming.h"
#include "ResourceRequest.h"
#include "ResourceResponse.h"
#include <wtf/Vector.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

void InputCoder<Vector<String> >::encode(InputEncoder& encoder, const Vector<String>& input)
{
    for (size_t i = 0; i < input.size(); i++)
        encoder.append(input[i]);
}

bool InputCoder<Vector<String> >::decode(InputDecoder&, OwnPtr<Vector<String> >&)
{
    // TODO: implement
    return false;
}

/* map is serialized from a WTF::HashMap, which has unique keys. So, this can be stored in an object */
void InputCoder<HTTPHeaderMap>::encode(InputEncoder& encoder, const HTTPHeaderMap& input)
{
    HTTPHeaderMap::const_iterator end_it = input.end();
    for (HTTPHeaderMap::const_iterator it = input.begin(); it != end_it; ++it)
        encoder.put(it->key.string(), it->value);
}

bool InputCoder<HTTPHeaderMap>::decode(InputDecoder&, OwnPtr<HTTPHeaderMap>&)
{
    // TODO: implement
    return false;
}

void InputCoder<FormDataElement>::encode(InputEncoder& encoder, const FormDataElement& element)
{
    encoder.put("type", (uint64_t)element.m_type);
    switch (element.m_type) {
    case FormDataElement::data:
        encoder.pushArray();
        for (size_t i = 0; i < element.m_data.size(); i++)
            encoder.append((uint32_t)element.m_data[i]);
        encoder.popArrayAsProperty("data");
        return;
    case FormDataElement::encodedFile:
        encoder.put("filename", element.m_filename);
        encoder.put("shouldGenerateFile", element.m_shouldGenerateFile);
#if ENABLE(BLOB)
        encoder.put("fileStart", element.m_fileStart);
        encoder.put("fileLength", (int64_t)element.m_fileLength);
        encoder.put("expectedFileModificationTime", element.m_expectedFileModificationTime);
#endif
        return;

#if ENABLE(BLOB)
    case FormDataElement::encodedBlob:
        encoder.put("blobURL", element.m_url.string());
        return;
#endif
    }
}

bool InputCoder<FormDataElement>::decode(InputDecoder&, OwnPtr<FormDataElement>&)
{
    // TODO: implement
    return false;
}

void InputCoder<FormData>::encode(InputEncoder& encoder, const FormData& data)
{
    // This is based on FormData::encodeForBackForward, except we use key/value objects instead
    // of a byte array.

    encoder.put("alwaysStream", data.alwaysStream());
    encoder.put("identifier", data.identifier());

    encoder.pushArray();
    const Vector<char> bytes = data.boundary();
    for (size_t i = 0; i < bytes.size(); i++)
        encoder.append((uint32_t)bytes[i]);
    encoder.popArrayAsProperty("boundary");

    encoder.pushArray();
    const Vector<FormDataElement> elems = data.elements();
    for (size_t i = 0; i < elems.size(); i++) {
        encoder.pushObject();
        InputCoder<FormDataElement>::encode(encoder, elems[i]);
        encoder.popObjectAsElement();
    }
    encoder.popArrayAsProperty("elements");
}

bool InputCoder<FormData>::decode(InputDecoder&, OwnPtr<FormData>&)
{
    // TODO: implement
    return false;
}

void InputCoder<ResourceLoadTiming>::encode(InputEncoder& encoder, const ResourceLoadTiming& data)
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

bool InputCoder<ResourceLoadTiming>::decode(InputDecoder&, OwnPtr<ResourceLoadTiming>&)
{
    // TODO: implement
    return false;
}

void InputCoder<ResourceError>::encode(InputEncoder& encoder, const ResourceError& error)
{
    encoder.put("domain", error.domain());
    encoder.put("errorCode", error.errorCode());
    encoder.put("failingURL", error.failingURL());
    encoder.put("localizedDescription", error.localizedDescription());
}

bool InputCoder<ResourceError>::decode(InputDecoder&, OwnPtr<ResourceError>&)
{
    // TODO: implement
    return false;
}

void InputCoder<ResourceRequest>::encode(InputEncoder& encoder, const ResourceRequest& request)
{
    encoder.put("url", request.url().string());
    encoder.put("cachePolicy", (uint64_t)request.cachePolicy());
    encoder.put("timeoutInterval", request.timeoutInterval());
    encoder.put("firstPartyForCookies", request.firstPartyForCookies().string());
    encoder.put("httpMethod", request.httpMethod());

    encoder.pushObject();
    InputCoder<HTTPHeaderMap>::encode(encoder, request.httpHeaderFields());
    encoder.popObjectAsProperty("httpHeaders");

    encoder.pushArray();
    InputCoder<Vector<String> >::encode(encoder, request.responseContentDispositionEncodingFallbackArray());
    encoder.popArrayAsProperty("responseContentDispositionEncodingFallbackArray");

    // sometimes, there's no form data.
    if (FormData* body = request.httpBody()) {
        encoder.pushObject();
        InputCoder<FormData>::encode(encoder, *body);
        encoder.popObjectAsProperty("httpBody");
    }

    encoder.put("allowCookies", request.allowCookies());
    encoder.put("loadPriority", (uint64_t)request.priority());
}

bool InputCoder<ResourceRequest>::decode(InputDecoder&, OwnPtr<ResourceRequest>&)
{
    // TODO: implement
    return false;
}

void InputCoder<ResourceResponse>::encode(InputEncoder& encoder, const ResourceResponse& response)
{
    encoder.put("url", response.url().string());
    encoder.put("mimeType", response.mimeType());
    encoder.put("expectedContentLength", (int64_t)response.expectedContentLength());
    encoder.put("textEncodingName", response.textEncodingName());
    encoder.put("suggestedFilename", response.suggestedFilename());
    encoder.put("httpStatusCode", response.httpStatusCode());
    encoder.put("httpStatusText", response.httpStatusText());

    encoder.pushObject();
    InputCoder<HTTPHeaderMap>::encode(encoder, response.httpHeaderFields());
    encoder.popObjectAsProperty("httpHeaders");

    encoder.put("lastModifiedDate", (uint64_t)response.lastModifiedDate());

    if (ResourceLoadTiming* data = response.resourceLoadTiming()) {
        encoder.pushObject();
        InputCoder<ResourceLoadTiming>::encode(encoder, *data);
        encoder.popObjectAsProperty("loadTiming");
    }
}

bool InputCoder<ResourceResponse>::decode(InputDecoder&, OwnPtr<ResourceResponse>&)
{
    // TODO: implement
    return false;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
