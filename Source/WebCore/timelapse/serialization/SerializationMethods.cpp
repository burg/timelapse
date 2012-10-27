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

#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

static void serializeStringVector(ActionSerializer* serializer, const Vector<String>& vec)
{
    for (size_t i = 0; i < vec.size(); i++)
        serializer->putString(vec[i]);
}

/* map is serialized from a WTF::HashMap, which has unique keys. So, this can be stored in an object */
static void serializeHTTPHeaderMap(ActionSerializer* serializer, const HTTPHeaderMap& map)
{
    HTTPHeaderMap::const_iterator end_it = map.end();
    for (HTTPHeaderMap::const_iterator it = map.begin(); it != end_it; ++it)
        serializer->putString(it->key.string(), it->value);
}

static void serializeFormDataElement(ActionSerializer* serializer, const FormDataElement& element)
{
    serializer->putInt("type", element.m_type);
    switch (element.m_type) {
    case FormDataElement::data:
        serializer->pushArray();
        for (size_t i = 0; i < element.m_data.size(); i++)
            serializer->pushUInt32(element.m_data[i]);
        serializer->popArrayAsProperty("data");
        return;
    case FormDataElement::encodedFile:
        serializer->putString("filename", element.m_filename);
        serializer->putBoolean("shouldGenerateFile", element.m_shouldGenerateFile);
#if ENABLE(BLOB)
        serializer->putInt64("fileStart", element.m_fileStart);
        serializer->putInt64("fileLength", element.m_fileLength);
        serializer->putDouble("exepcetedFileModificationTime", element.m_expectedFileModificationTime);
#endif
        return;

#if ENABLE(BLOB)
    case FormDataElement::encodedBlob:
        serializer->putString(element.m_url.string());
        return;
#endif
    }
}

// This is based on FormData::encodeForBackForward, except we use key/value objects instead
// of a byte array.
static void serializeFormData(ActionSerializer* serializer, FormData* data)
{
    // sometimes, there's no form data.
    if (!data)
        return;

    serializer->putBoolean("alwaysStream", data->alwaysStream());
    serializer->putInt64("identifier", data->identifier());

    serializer->pushArray();
    const Vector<char> bytes = data->boundary();
    for (size_t i = 0; i < bytes.size(); i++)
        serializer->pushUInt32(bytes[i]);
    serializer->popArrayAsProperty("boundary");

    serializer->pushArray();
    const Vector<FormDataElement> elems = data->elements(); 
    for (size_t i = 0; i < elems.size(); i++) {
        serializer->pushObject();
        serializeFormDataElement(serializer, elems[i]);
        serializer->popObjectAsElement();
    }
    serializer->popArrayAsProperty("elements");
}

static void serializeResourceLoadTiming(ActionSerializer* serializer, ResourceLoadTiming* data)
{
    serializer->putDouble("requestTime", data->requestTime);
    serializer->putInt("proxyStart", data->proxyStart);
    serializer->putInt("proxyEnd", data->proxyEnd);
    serializer->putInt("dnsStart", data->dnsStart);
    serializer->putInt("dnsEnd", data->dnsEnd);
    serializer->putInt("connectStart", data->connectStart);
    serializer->putInt("connectEnd", data->connectEnd);
    serializer->putInt("sendStart", data->sendStart);
    serializer->putInt("sendEnd", data->sendEnd);
    serializer->putInt("receiveHeadersEnd", data->receiveHeadersEnd);
    serializer->putInt("sslStart", data->sslStart);
    serializer->putInt("sslEnd", data->sslEnd);
}

void serializeResourceError(ActionSerializer* serializer, const ResourceError& error)
{
    serializer->putString("domain", error.domain());
    serializer->putInt("errorCode", error.errorCode());
    serializer->putString("failingURL", error.failingURL());
    serializer->putString("localizedDescription", error.localizedDescription());
}

void serializeResourceRequest(ActionSerializer* serializer, const ResourceRequest* request)
{
    serializer->putString("url", request->url().string());
    serializer->putInt("cachePolicy", request->cachePolicy());
    serializer->putDouble("timeoutInterval", request->timeoutInterval());
    serializer->putString("firstPartyForCookies", request->firstPartyForCookies().string());
    serializer->putString("httpMethod", request->httpMethod());

    serializer->pushObject();
    serializeHTTPHeaderMap(serializer, request->httpHeaderFields());
    serializer->popObjectAsProperty("httpHeaders");

    serializer->pushArray();
    serializeStringVector(serializer, request->responseContentDispositionEncodingFallbackArray());
    serializer->popArrayAsProperty("responseContentDispositionEncodingFallbackArray");

    serializer->pushObject();
    serializeFormData(serializer, request->httpBody());
    serializer->popObjectAsProperty("httpBody");

    serializer->putBoolean("allowCookies", request->allowCookies());
    serializer->putInt("loadPriority", request->priority());
}

void serializeResourceResponse(ActionSerializer* serializer, const ResourceResponse* response)
{
    serializer->putString("url", response->url().string());
    serializer->putString("mimeType", response->mimeType());
    serializer->putDouble("expectedContentLength", response->expectedContentLength());
    serializer->putString("textEncodingName", response->textEncodingName());
    serializer->putString("suggestedFilename", response->suggestedFilename());
    serializer->putInt("httpStatusCode", response->httpStatusCode());
    serializer->putString("httpStatusText", response->httpStatusText());

    serializer->pushObject();
    serializeHTTPHeaderMap(serializer, response->httpHeaderFields());
    serializer->popObjectAsProperty("httpHeaders");

    serializer->putDouble("lastModifiedDate", response->lastModifiedDate());
    
    if (ResourceLoadTiming* data = response->resourceLoadTiming()) {
        serializer->pushObject();
        serializeResourceLoadTiming(serializer, data);
        serializer->popObjectAsProperty("loadTiming");
    }
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
