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

#ifndef NetworkProxy_h
#define NetworkProxy_h

#include "ResourceHandle.h"
#include "ReplayProxy.h"
#include <wtf/PassOwnPtr.h>
#include <wtf/Noncopyable.h>

namespace WebCore {

class ReplayController;
class NetworkingContext;
class ResourceHandleClient;
class ResourceRequest;

typedef std::pair<RefPtr<ResourceHandle>, ResourceHandleClient*> HandleContext;

class NetworkProxy : public ReplayProxy {
    WTF_MAKE_NONCOPYABLE(NetworkProxy);

public:
    static PassOwnPtr<NetworkProxy> create(Page*);
    virtual ~NetworkProxy() {}

#if ENABLE(WEB_REPLAY)
    HandleContext handleContextById(int);
    void removeHandleById(int);
    ReplayController& controller() const;
    int nextLoaderId(const ResourceRequest&);

    // These flags manage the initial sequence leading up to controller->capturing()
    // or controller->replaying() becoming true.
    bool expectsPageLoad() const { return m_expectsPageLoad; }
    void setExpectsPageLoad(bool value) { m_expectsPageLoad = value; }
#endif // ENABLE(WEB_REPLAY)

    PassRefPtr<ResourceHandle> createResourceHandle(NetworkingContext*, const ResourceRequest&, ResourceHandleClient*, int loaderId, bool, bool);

private:
    NetworkProxy(Page*);

#if ENABLE(WEB_REPLAY)
    int m_nextId;
    bool m_expectsPageLoad;
    HashMap<int, HandleContext> m_replayHandleMap;
#endif // ENABLE(WEB_REPLAY)
};

} // namespace WebCore

#endif // NetworkProxy_h
