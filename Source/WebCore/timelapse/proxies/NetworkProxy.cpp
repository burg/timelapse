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

#include "NetworkProxy.h"

#include "CapturingResourceHandleClient.h"
#include "DeterminismController.h"
#include "EmptyClients.h"
#include "NetworkingContext.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "ResourceHandleCreated.h"
#include "ResourceRequest.h"
#include <wtf/timelapse/DeterminismLog.h>

/* We must always define these symbols even if Timelapse support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with Timelapse support. */

namespace WebCore {

NetworkProxy::NetworkProxy(Page* page)
: TimelapseProxy(page)
// start at 1, since WTF::DefaultHash<unsigned> disallows UINT_MIN and UINT_MAX
, m_nextId(1)
, m_replayHandleMap(HashMap<int, HandleContext>()) {} 

PassOwnPtr<NetworkProxy> NetworkProxy::create(Page* page)
{
    return adoptPtr(new NetworkProxy(page));
}

#if ENABLE(TIMELAPSE)
HandleContext NetworkProxy::handleContextById(int id)
{
    return m_replayHandleMap.get(id);
}

void NetworkProxy::removeHandleById(int id)
{
    m_replayHandleMap.remove(id);
}

DeterminismController* NetworkProxy::controller() const
{
    return m_page->determinismController();
}
#endif // ENABLE(TIMELAPSE)

PassRefPtr<ResourceHandle> NetworkProxy::createResourceHandle(NetworkingContext* context, const ResourceRequest& request, ResourceHandleClient* client, bool defersLoading, bool shouldContentSniff)
{
#if ENABLE(TIMELAPSE)
    if (mode() == TimelapseProxy::Capturing) {
        CapturingResourceHandleClient* captureShim = new CapturingResourceHandleClient(this, client, m_nextId++);
        controller()->determinismLog()->append(new ResourceHandleCreated(captureShim->id(), request, defersLoading, shouldContentSniff));
        return ResourceHandle::create(context, request, captureShim, defersLoading, shouldContentSniff);
    }

    if (mode() == TimelapseProxy::Replaying) {
        RefPtr<DeterminismLog> detLog = controller()->determinismLog();
        ResourceHandleCreated* memoizedHandle = static_cast<ResourceHandleCreated*>(detLog->currentAction(ReplayableTypes::ResourceHandleCreated));
        int handleId = memoizedHandle->id();
        
        ASSERT(ResourceRequestBase::compare(*memoizedHandle->request(), request));

        ResourceHandleClient* emptyClient = new EmptyResourceHandleClient();
        // TODO: maybe make a dummy ResourceHandle class that doesn't actually fetch resources.
        RefPtr<ResourceHandle> newHandle = ResourceHandle::create(context, request, emptyClient, defersLoading, shouldContentSniff);

        m_replayHandleMap.set(handleId, std::make_pair(newHandle, client));
        return newHandle;
    }

#endif // ENABLE(TIMELAPSE)

    return ResourceHandle::create(context, request, client, defersLoading, shouldContentSniff);
}

} // namespace WebCore

