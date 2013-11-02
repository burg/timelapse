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

#include "CapturingResourceHandleClient.h"

#include "CaptureInputIterator.h"
#include "Frame.h"
#include "FrameLoader.h"
#include "NetworkProxy.h"
#include "NetworkingContext.h"
#include "Page.h"
#include "ReplayController.h"
#include "ResourceDidFail.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceDidSendData.h"
#include "ResourceHandle.h"
#include "ResourceLoader.h"
#include "ResourceRequest.h"
#include "ResourceWillSendRequest.h"
#include <wtf/replay/InputIterator.h>

namespace WebCore {

CapturingResourceHandleClient::CapturingResourceHandleClient(NetworkProxy* proxy, ResourceLoader* loader)
: m_proxy(proxy)
, m_loader(loader) {}

CapturingResourceHandleClient::~CapturingResourceHandleClient() {}

unsigned long CapturingResourceHandleClient::identifier() const
{
    return m_loader->identifier();
}

int CapturingResourceHandleClient::frameIndex() const
{
    Document* document = m_loader->frameLoader()->frame().document();
    ASSERT(document);
    return frameIndexFromDocument(document);
}

// ResourceHandleClient API
void CapturingResourceHandleClient::willSendRequest(ResourceHandle* handle, ResourceRequest& request, const ResourceResponse& redirectResponse)
{
    InputIterator* it = m_proxy->controller().activeIterator();
    if (it)
        it->storeInput(std::make_unique<ResourceWillSendRequest>(identifier(), frameIndex(), request, redirectResponse));

    EventLoopInputExtent extent(it);
    m_loader->willSendRequest(handle, request, redirectResponse);
}

void CapturingResourceHandleClient::didSendData(ResourceHandle* handle, unsigned long long bytesSent, unsigned long long totalBytesToBeSent)
{
    InputIterator* it = m_proxy->controller().activeIterator();
    if (it)
        it->storeInput(std::make_unique<ResourceDidSendData>(identifier(), frameIndex(), bytesSent, totalBytesToBeSent));

    EventLoopInputExtent extent(it);
    m_loader->didSendData(handle, bytesSent, totalBytesToBeSent);
}

void CapturingResourceHandleClient::didReceiveResponse(ResourceHandle* handle, const ResourceResponse& response)
{
    InputIterator* it = m_proxy->controller().activeIterator();

    if (it)
        it->storeInput(std::make_unique<ResourceDidReceiveResponse>(identifier(), frameIndex(), response));

    EventLoopInputExtent extent(it);
    m_loader->didReceiveResponse(handle, response);
}

void CapturingResourceHandleClient::didReceiveData(ResourceHandle* handle, const char* data, int length, int encodedLength)
{
    InputIterator* it = m_proxy->controller().activeIterator();
    if (it)
        it->storeInput(std::make_unique<ResourceDidReceiveData>(identifier(), frameIndex(), data, length, encodedLength));

    EventLoopInputExtent extent(it);
    m_loader->didReceiveData(handle, data, length, encodedLength);
}

void CapturingResourceHandleClient::didFinishLoading(ResourceHandle* handle, double finishTime)
{
    InputIterator* it = m_proxy->controller().activeIterator();
    if (it)
        it->storeInput(std::make_unique<ResourceDidFinishLoading>(identifier(), frameIndex(), finishTime));

    EventLoopInputExtent extent(it);
    m_loader->didFinishLoading(handle, finishTime);
}

void CapturingResourceHandleClient::didFail(ResourceHandle* handle, const ResourceError& error)
{
    InputIterator* it = m_proxy->controller().activeIterator();
    if (it)
        it->storeInput(std::make_unique<ResourceDidFail>(identifier(), frameIndex(), error));

    EventLoopInputExtent extent(it);
    m_loader->didFail(handle, error);
}

void CapturingResourceHandleClient::wasBlocked(ResourceHandle* handle)
{
    didFail(handle, m_loader->blockedError());
}

void CapturingResourceHandleClient::cannotShowURL(ResourceHandle* handle)
{
    didFail(handle, m_loader->cannotShowURLError());
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
