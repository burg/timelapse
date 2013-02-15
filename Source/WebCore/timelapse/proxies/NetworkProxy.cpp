/*
 *  Copyright (C) 2012 Brian Burg.
 *  Copyright (C) 2012 University of Washington. All rights reserved.
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
#include "InspectorInstrumentation.h"
#include "NetworkingContext.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "ResourceLoaderCreated.h"
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

int NetworkProxy::nextLoaderId(const ResourceRequest& request)
{
    if (mode() == TimelapseProxy::Capturing) {
        int freshId = m_nextId++;
        controller()->determinismLog()->append(new ResourceLoaderCreated(freshId, request));

        return freshId;
    }

    if (mode() == TimelapseProxy::Replaying) {
        RefPtr<DeterminismLog> detLog = controller()->determinismLog();

        int loaderId;
        ResourceLoaderCreated* memoizedData = static_cast<ResourceLoaderCreated*>(detLog->popExpectedAction(WTF::LoaderMemoizedDataQueue, ReplayableTypes::ResourceLoaderCreated));
        if (memoizedData)
            loaderId = memoizedData->id();
        else // error handling case
            loaderId = -1;
        
        // error handling when requests don't match
        if (!memoizedData || !ResourceRequestBase::compare(*memoizedData->request(), request)) {
            LOG_ERROR("%-30s Network request details differ from request observed when recording.", "[NetworkProxy]");
            LOG_ERROR("Replayed request URL: %s", request.url().string().utf8().data());

            if (memoizedData)
                LOG_ERROR("Memoized request URL: %s", memoizedData->request()->url().string().utf8().data());
            else
                LOG_ERROR("Memoized request: NULL");

            // FIXME(BJB): in general, I don't think a soft error is appropriate here. But,
            // let's see how often it has bad consequences.
            controller()->playbackError(false,
                                        "Network request details missing or differ from request observed when recording.");
        }
        
        return loaderId;
    }
    
    return -1;
}
#endif // ENABLE(TIMELAPSE)

PassRefPtr<ResourceHandle> NetworkProxy::createResourceHandle(NetworkingContext* context, const ResourceRequest& request, ResourceHandleClient* client, int loaderId, bool defersLoading, bool shouldContentSniff)
{
#if ENABLE(TIMELAPSE)
    if (mode() == TimelapseProxy::Capturing) {
        ASSERT(loaderId > 0);
        CapturingResourceHandleClient* captureShim = new CapturingResourceHandleClient(this, client, loaderId);
        return ResourceHandle::create(context, request, captureShim, defersLoading, shouldContentSniff);
    }

    if (mode() == TimelapseProxy::Replaying) {
        ResourceHandleClient* emptyClient = new EmptyResourceHandleClient();
        // TODO: maybe make a dummy ResourceHandle class that doesn't actually fetch resources.
        RefPtr<ResourceHandle> newHandle = ResourceHandle::create(context, request, emptyClient, defersLoading, shouldContentSniff);

        m_replayHandleMap.set(loaderId, std::make_pair(newHandle, client));
        return newHandle;
    }
#else
    UNUSED_PARAM(loaderId);
#endif // ENABLE(TIMELAPSE)
    
    return ResourceHandle::create(context, request, client, defersLoading, shouldContentSniff);
}

} // namespace WebCore

