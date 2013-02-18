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

#ifndef CapturingResourceHandleClient_h
#define CapturingResourceHandleClient_h

#if ENABLE(TIMELAPSE)

#include "ResourceHandleClient.h"

namespace WebCore {

class AuthenticationChallenge;
class NetworkProxy;
class NetworkingContext;
class Page;
class ResourceError;
class ResourceHandle;
class ResourceRequest;
class ResourceResponse;

// Lifetime is pinned to NetworkProxy

class CapturingResourceHandleClient : public ResourceHandleClient {

public:
    CapturingResourceHandleClient(NetworkProxy*, ResourceHandleClient*, int);
    virtual ~CapturingResourceHandleClient();

    int id() const { return m_id; }

    // ResourceHandleClient API
    virtual void willSendRequest(ResourceHandle*, ResourceRequest&, const ResourceResponse&) OVERRIDE;
    virtual void didSendData(ResourceHandle*, unsigned long long, unsigned long long) OVERRIDE;
    virtual void didReceiveResponse(ResourceHandle*, const ResourceResponse&) OVERRIDE;
    virtual void didReceiveData(ResourceHandle*, const char*, int, int) OVERRIDE;
    virtual void didReceiveCachedMetadata(ResourceHandle*, const char*, int) OVERRIDE;
    virtual void didFinishLoading(ResourceHandle*, double) OVERRIDE;
    virtual void didFail(ResourceHandle*, const ResourceError&) OVERRIDE;
    virtual void wasBlocked(ResourceHandle*) OVERRIDE;
    virtual void cannotShowURL(ResourceHandle*) OVERRIDE;
    virtual bool shouldUseCredentialStorage(ResourceHandle*) OVERRIDE;
    virtual void didReceiveAuthenticationChallenge(ResourceHandle*, const AuthenticationChallenge&) OVERRIDE;
    virtual void didCancelAuthenticationChallenge(ResourceHandle*, const AuthenticationChallenge&) OVERRIDE;
    virtual void receivedCancellation(ResourceHandle*, const AuthenticationChallenge&) OVERRIDE;
    
private:
    NetworkProxy* m_proxy;
    ResourceHandleClient* m_client;
    int m_id;
};
    
} // namespace WebCore

#endif  // ENABLE(TIMELAPSE)

#endif // CapturingResourceHandleClient_h
