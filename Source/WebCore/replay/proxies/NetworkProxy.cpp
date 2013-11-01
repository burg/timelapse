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
    std::unique_ptr<EncoderContext> encoder = JSONCoder::createMap();
    InputCoder<ResourceRequest>::encode(*encoder, request);
    RefPtr<InspectorValue> value = static_cast<JSONEncoderContext*>(encoder.get())->encodedValue();
    String jsonString = value->toJSONString();

    LOG(DeterministicReplay, "---\n%s", jsonString.utf8().data());
}
#endif

NetworkProxy::NetworkProxy(Page& page)
: ReplayProxy(page)
, m_nextUniqueIdentifier(1)
#if ENABLE(WEB_REPLAY)
, m_expectsPageLoad(false)
, m_replayHandleMap(HashMap<unsigned long, HandleContext>())
#endif
{}

NetworkProxy::~NetworkProxy()
{}

void NetworkProxy::setProxyMode(ProxyMode mode)
{
    ReplayProxy::setProxyMode(mode);
    m_nextUniqueIdentifier = 1;
}

unsigned long NetworkProxy::createUniqueIdentifier()
{
    return m_nextUniqueIdentifier++;
}

unsigned long NetworkProxy::createUniqueIdentifierWithRequest(const ResourceRequest& request)
{
    unsigned long identifier = createUniqueIdentifier();
#if ENABLE(WEB_REPLAY)
    if (mode() == Capturing)
        controller().activeIterator()->storeInput(std::make_unique<ResourceLoaderCreated>(identifier, request));

    if (mode() == Replaying) {
        ResourceLoaderCreated* memoizedData = static_cast<ResourceLoaderCreated*>(controller().activeIterator()->loadInput(NondeterministicInput::LoaderMemoizedDataQueue, inputTypes().ResourceLoaderCreated));
        unsigned long memoizedIdentifier = memoizedData ? memoizedData->identifier() : 0;
        bool failed = true;

        if (!memoizedData)
            controller().playbackError(false, "Memoized network request details were missing.");
        else if (!ResourceRequestBase::compare(memoizedData->request(), request)) {
            controller().playbackError(false, "Network request details differ from request observed when recording.");
            failed = true;
            LOG(DeterministicReplay, "Memoized request information:");
            printResourceRequestDiagnostics(memoizedData->request());
        } else if (memoizedIdentifier != identifier)
            controller().playbackError(false, String::format("Different number of identifiers created on capture and replay. (memoized: %lu, actual %lu)", memoizedIdentifier, identifier));
        else
            failed = false;

        if (failed) {
            LOG(DeterministicReplay, "Actual request information:");
            printResourceRequestDiagnostics(request);
        }
    }
#else
    UNUSED_PARAM(request);
#endif
    return identifier;
}

#if ENABLE(WEB_REPLAY)
HandleContext NetworkProxy::handleContextByIdentifier(unsigned long identifier)
{
    return m_replayHandleMap.get(identifier);
}

void NetworkProxy::removeHandleByIdentifier(unsigned long identifier)
{
    m_replayHandleMap.remove(identifier);
}

ReplayController& NetworkProxy::controller() const
{
    return m_page.replayController();
}
#endif // ENABLE(WEB_REPLAY)

PassRefPtr<ResourceHandle> NetworkProxy::createResourceHandle(NetworkingContext* context, const ResourceRequest& request, ResourceHandleClient* client, unsigned long identifier, bool defersLoading, bool shouldContentSniff)
{
#if ENABLE(WEB_REPLAY)
    if (mode() == ReplayProxy::Capturing) {
        CapturingResourceHandleClient* captureShim = new CapturingResourceHandleClient(this, client, identifier);
        return ResourceHandle::create(context, request, captureShim, defersLoading, shouldContentSniff);
    }

    if (mode() == ReplayProxy::Replaying) {
        ResourceHandleClient* emptyClient = new EmptyResourceHandleClient();
        // TODO: maybe make a dummy ResourceHandle class that doesn't actually fetch resources.
        RefPtr<ResourceHandle> newHandle = ResourceHandle::create(context, request, emptyClient, defersLoading, shouldContentSniff);

        m_replayHandleMap.set(identifier, std::make_pair(newHandle, client));
        return newHandle;
    }
#else
    UNUSED_PARAM(identifier);
#endif // ENABLE(WEB_REPLAY)

    return ResourceHandle::create(context, request, client, defersLoading, shouldContentSniff);
}

} // namespace WebCore
