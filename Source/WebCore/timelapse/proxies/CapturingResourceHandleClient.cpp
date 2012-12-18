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

#include "CapturingResourceHandleClient.h"

#include "DeterminismController.h"
#include "NetworkProxy.h"
#include "NetworkingContext.h"
#include "Page.h"
#include "ResourceCannotShowURL.h"
#include "ResourceDidFail.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveCachedMetadata.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceDidSendData.h"
#include "ResourceHandle.h"
#include "ResourceLoaderDestroyed.h"
#include "ResourceRequest.h"
#include "ResourceWasBlocked.h"
#include "ResourceWillCacheResponse.h"
#include "ResourceWillSendRequest.h"

namespace WebCore {

CapturingResourceHandleClient::CapturingResourceHandleClient(NetworkProxy* proxy, ResourceHandleClient* client, int id)
: m_proxy(proxy)
, m_client(client)
, m_id(id) {}

CapturingResourceHandleClient::~CapturingResourceHandleClient()
{
    // FIXME: this will probably do the wrong thing if the ResourceLoader switches
    // between two different handles without completely loading one.
    m_proxy->controller()->capturePageInput(new ResourceLoaderDestroyed(m_id));
}

// ResourceHandleClient API
void CapturingResourceHandleClient::willSendRequest(ResourceHandle* handle, ResourceRequest& request, const ResourceResponse& redirectResponse)
{
    m_proxy->controller()->capturePageInput(new ResourceWillSendRequest(m_id, request, redirectResponse));
    m_client->willSendRequest(handle, request, redirectResponse);
}

void CapturingResourceHandleClient::didSendData(ResourceHandle* handle, unsigned long long bytesSent, unsigned long long totalBytesToBeSent)
{
    m_proxy->controller()->capturePageInput(new ResourceDidSendData(m_id, bytesSent, totalBytesToBeSent));
    m_client->didSendData(handle, bytesSent, totalBytesToBeSent);
}

void CapturingResourceHandleClient::didReceiveResponse(ResourceHandle* handle, const ResourceResponse& response)
{
    m_proxy->controller()->capturePageInput(new ResourceDidReceiveResponse(m_id, response));
    m_client->didReceiveResponse(handle, response);
}

void CapturingResourceHandleClient::didReceiveData(ResourceHandle* handle, const char* data, int length, int encodedLength)
{
    m_proxy->controller()->capturePageInput(new ResourceDidReceiveData(m_id, data, length, encodedLength));
    m_client->didReceiveData(handle, data, length, encodedLength);
}

void CapturingResourceHandleClient::didReceiveCachedMetadata(ResourceHandle* handle, const char* data, int length)
{
    m_proxy->controller()->capturePageInput(new ResourceDidReceiveCachedMetadata(m_id, data, length));
    m_client->didReceiveCachedMetadata(handle, data, length);
}

void CapturingResourceHandleClient::didFinishLoading(ResourceHandle* handle, double finishTime)
{
    m_proxy->controller()->capturePageInput(new ResourceDidFinishLoading(m_id, finishTime));
    m_client->didFinishLoading(handle, finishTime);
}

void CapturingResourceHandleClient::didFail(ResourceHandle* handle, const ResourceError& error)
{
    m_proxy->controller()->capturePageInput(new ResourceDidFail(m_id, error));
    m_client->didFail(handle, error);
}

void CapturingResourceHandleClient::wasBlocked(ResourceHandle* handle)
{
    m_proxy->controller()->capturePageInput(new ResourceWasBlocked(m_id));
    m_client->wasBlocked(handle);
}

void CapturingResourceHandleClient::cannotShowURL(ResourceHandle* handle)
{
    m_proxy->controller()->capturePageInput(new ResourceCannotShowURL(m_id));
    m_client->cannotShowURL(handle);
}

void CapturingResourceHandleClient::willCacheResponse(ResourceHandle* handle, CacheStoragePolicy& policy)
{
    m_proxy->controller()->capturePageInput(new ResourceWillCacheResponse(m_id, policy));
    m_client->willCacheResponse(handle, policy);
}

bool CapturingResourceHandleClient::shouldUseCredentialStorage(ResourceHandle* handle)
{
    bool result = m_client->shouldUseCredentialStorage(handle);
    // TODO: create a ReplayableAction to hold 'result', someday. Is this likely to change?
    return result;
}

void CapturingResourceHandleClient::didReceiveAuthenticationChallenge(ResourceHandle* handle, const AuthenticationChallenge& challenge)
{
    // TODO: find a way to capture and replay when authentication was used, but without
    // storing passwords in plaintext. Maybe fake up response to accept blank credentials?
    m_client->didReceiveAuthenticationChallenge(handle, challenge);
}

void CapturingResourceHandleClient::didCancelAuthenticationChallenge(ResourceHandle* handle, const AuthenticationChallenge& challenge)
{
    // see above
    m_client->didCancelAuthenticationChallenge(handle, challenge);
}

void CapturingResourceHandleClient::receivedCancellation(ResourceHandle* handle, const AuthenticationChallenge& challenge)
{
    // see above
    m_client->receivedCancellation(handle, challenge);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
