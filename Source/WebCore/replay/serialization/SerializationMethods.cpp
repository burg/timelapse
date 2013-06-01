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

#include "SerializationMethods.h"

#include "HTTPHeaderMap.h"
#include "ResourceError.h"
#include "ResourceLoadTiming.h"
#include "ResourceRequest.h"
#include "ResourceResponse.h"

#include <wtf/replay/InputCoder.h>

namespace WebCore {

static void serializeStringVector(InputCoder& coder, const Vector<String>& vec)
{
    for (size_t i = 0; i < vec.size(); i++)
        coder.putString(vec[i]);
}

/* map is serialized from a WTF::HashMap, which has unique keys. So, this can be stored in an object */
static void serializeHTTPHeaderMap(InputCoder& coder, const HTTPHeaderMap& map)
{
    HTTPHeaderMap::const_iterator end_it = map.end();
    for (HTTPHeaderMap::const_iterator it = map.begin(); it != end_it; ++it)
        coder.putString(it->key.string(), it->value);
}

static void serializeFormDataElement(InputCoder& coder, const FormDataElement& element)
{
    coder.putInt("type", element.m_type);
    switch (element.m_type) {
    case FormDataElement::data:
        coder.pushArray();
        for (size_t i = 0; i < element.m_data.size(); i++)
            coder.pushUInt32(element.m_data[i]);
        coder.popArrayAsProperty("data");
        return;
    case FormDataElement::encodedFile:
        coder.putString("filename", element.m_filename);
        coder.putBoolean("shouldGenerateFile", element.m_shouldGenerateFile);
#if ENABLE(BLOB)
        coder.putInt64("fileStart", element.m_fileStart);
        coder.putInt64("fileLength", element.m_fileLength);
        coder.putDouble("exepcetedFileModificationTime", element.m_expectedFileModificationTime);
#endif
        return;

#if ENABLE(BLOB)
    case FormDataElement::encodedBlob:
        coder.putString(element.m_url.string());
        return;
#endif
    }
}

// This is based on FormData::encodeForBackForward, except we use key/value objects instead
// of a byte array.
static void serializeFormData(InputCoder& coder, FormData* data)
{
    // sometimes, there's no form data.
    if (!data)
        return;

    coder.putBoolean("alwaysStream", data->alwaysStream());
    coder.putInt64("identifier", data->identifier());

    coder.pushArray();
    const Vector<char> bytes = data->boundary();
    for (size_t i = 0; i < bytes.size(); i++)
        coder.pushUInt32(bytes[i]);
    coder.popArrayAsProperty("boundary");

    coder.pushArray();
    const Vector<FormDataElement> elems = data->elements();
    for (size_t i = 0; i < elems.size(); i++) {
        coder.pushObject();
        serializeFormDataElement(coder, elems[i]);
        coder.popObjectAsElement();
    }
    coder.popArrayAsProperty("elements");
}

static void serializeResourceLoadTiming(InputCoder& coder, ResourceLoadTiming* data)
{
    coder.putDouble("requestTime", data->requestTime);
    coder.putInt("proxyStart", data->proxyStart);
    coder.putInt("proxyEnd", data->proxyEnd);
    coder.putInt("dnsStart", data->dnsStart);
    coder.putInt("dnsEnd", data->dnsEnd);
    coder.putInt("connectStart", data->connectStart);
    coder.putInt("connectEnd", data->connectEnd);
    coder.putInt("sendStart", data->sendStart);
    coder.putInt("sendEnd", data->sendEnd);
    coder.putInt("receiveHeadersEnd", data->receiveHeadersEnd);
    coder.putInt("sslStart", data->sslStart);
    coder.putInt("sslEnd", data->sslEnd);
}

void serializeResourceError(InputCoder& coder, const ResourceError& error)
{
    coder.putString("domain", error.domain());
    coder.putInt("errorCode", error.errorCode());
    coder.putString("failingURL", error.failingURL());
    coder.putString("localizedDescription", error.localizedDescription());
}

void serializeResourceRequest(InputCoder& coder, const ResourceRequest* request)
{
    coder.putString("url", request->url().string());
    coder.putInt("cachePolicy", request->cachePolicy());
    coder.putDouble("timeoutInterval", request->timeoutInterval());
    coder.putString("firstPartyForCookies", request->firstPartyForCookies().string());
    coder.putString("httpMethod", request->httpMethod());

    coder.pushObject();
    serializeHTTPHeaderMap(coder, request->httpHeaderFields());
    coder.popObjectAsProperty("httpHeaders");

    coder.pushArray();
    serializeStringVector(coder, request->responseContentDispositionEncodingFallbackArray());
    coder.popArrayAsProperty("responseContentDispositionEncodingFallbackArray");

    coder.pushObject();
    serializeFormData(coder, request->httpBody());
    coder.popObjectAsProperty("httpBody");

    coder.putBoolean("allowCookies", request->allowCookies());
    coder.putInt("loadPriority", request->priority());
}

void serializeResourceResponse(InputCoder& coder, const ResourceResponse* response)
{
    coder.putString("url", response->url().string());
    coder.putString("mimeType", response->mimeType());
    coder.putDouble("expectedContentLength", response->expectedContentLength());
    coder.putString("textEncodingName", response->textEncodingName());
    coder.putString("suggestedFilename", response->suggestedFilename());
    coder.putInt("httpStatusCode", response->httpStatusCode());
    coder.putString("httpStatusText", response->httpStatusText());

    coder.pushObject();
    serializeHTTPHeaderMap(coder, response->httpHeaderFields());
    coder.popObjectAsProperty("httpHeaders");

    coder.putDouble("lastModifiedDate", response->lastModifiedDate());

    if (ResourceLoadTiming* data = response->resourceLoadTiming()) {
        coder.pushObject();
        serializeResourceLoadTiming(coder, data);
        coder.popObjectAsProperty("loadTiming");
    }
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
