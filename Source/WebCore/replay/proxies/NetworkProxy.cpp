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

#include "NetworkingContext.h"
#include "ResourceHandle.h"
#include "ResourceHandleClient.h"
#include "ResourceRequest.h"
#include <wtf/text/CString.h>

#if ENABLE(WEB_REPLAY)
#include "CapturingResourceHandleClient.h"
#include "EmptyClients.h"
#include "JSONEncoderContext.h"
#include "Logging.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ReplayRecording.h"
#include "ResourceLoaderCreated.h"
#include "SerializationMethods.h"
#include <wtf/replay/InputIterator.h>
#endif

/* We must always define these symbols even if web replay support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with web replay support. */

namespace WebCore {

#if ENABLE(WEB_REPLAY)
static void printResourceRequestDiagnostics(const ResourceRequest& request)
{
    OwnPtr<EncoderContext> encoder = JSONCoder::createMap();
    InputCoder<ResourceRequest>::encode(*encoder, request);
    RefPtr<InspectorValue> value = static_cast<JSONEncoderContext*>(encoder.get())->encodedValue();
    String jsonString = value->toJSONString();

    LOG(DeterministicReplay, "---\n%s", jsonString.utf8().data());
}
#endif

NetworkProxy::NetworkProxy(Page& page)
: ReplayProxy(page)
#if ENABLE(WEB_REPLAY)
// Start at 1, since WTF::DefaultHash<unsigned> disallows UINT_MIN and UINT_MAX.
, m_nextId(1)
, m_expectsPageLoad(false)
, m_replayHandleMap(HashMap<int, HandleContext>())
#endif
{}

NetworkProxy::~NetworkProxy()
{}

#if ENABLE(WEB_REPLAY)
HandleContext NetworkProxy::handleContextById(int id)
{
    return m_replayHandleMap.get(id);
}

void NetworkProxy::removeHandleById(int id)
{
    m_replayHandleMap.remove(id);
}

ReplayController& NetworkProxy::controller() const
{
    return m_page.replayController();
}

int NetworkProxy::nextLoaderId(const ResourceRequest& request)
{
    InputIterator* it = controller().activeIterator();

    if (mode() == ReplayProxy::Capturing) {
        ASSERT(it && it->isCapturing());
        int freshId = m_nextId++;
        controller().activeIterator()->storeInput(adoptPtr(new ResourceLoaderCreated(freshId, request)));

        return freshId;
    }

    if (mode() == ReplayProxy::Replaying) {
        ASSERT(it && it->isReplaying());
        ResourceLoaderCreated* memoizedData = static_cast<ResourceLoaderCreated*>(it->loadInput(NondeterministicInput::LoaderMemoizedDataQueue, inputTypes().ResourceLoaderCreated));
        int loaderId = memoizedData ? memoizedData->handleId() : -1;

        // FIXME: is a soft error appropriate here?
        if (!memoizedData)
            controller().playbackError(false, "Memoized network request details were missing.");
        else if (!ResourceRequestBase::compare(memoizedData->request(), request)) {
            controller().playbackError(false, "Network request details differ from request observed when recording.");

            LOG(DeterministicReplay, "Memoized request information:");
            printResourceRequestDiagnostics(memoizedData->request());
        }
        else // Normal case: requests are equal.
            return loaderId;

        LOG(DeterministicReplay, "Actual request information:");
        printResourceRequestDiagnostics(request);
    }

    return -1;
}
#endif // ENABLE(WEB_REPLAY)

PassRefPtr<ResourceHandle> NetworkProxy::createResourceHandle(NetworkingContext* context, const ResourceRequest& request, ResourceHandleClient* client, int loaderId, bool defersLoading, bool shouldContentSniff)
{
#if ENABLE(WEB_REPLAY)
    if (mode() == ReplayProxy::Capturing) {
        ASSERT(loaderId > 0);
        CapturingResourceHandleClient* captureShim = new CapturingResourceHandleClient(this, client, loaderId);
        return ResourceHandle::create(context, request, captureShim, defersLoading, shouldContentSniff);
    }

    if (mode() == ReplayProxy::Replaying) {
        ResourceHandleClient* emptyClient = new EmptyResourceHandleClient();
        // TODO: maybe make a dummy ResourceHandle class that doesn't actually fetch resources.
        RefPtr<ResourceHandle> newHandle = ResourceHandle::create(context, request, emptyClient, defersLoading, shouldContentSniff);

        m_replayHandleMap.set(loaderId, std::make_pair(newHandle, client));
        return newHandle;
    }
#else
    UNUSED_PARAM(loaderId);
#endif // ENABLE(WEB_REPLAY)

    return ResourceHandle::create(context, request, client, defersLoading, shouldContentSniff);
}

} // namespace WebCore
