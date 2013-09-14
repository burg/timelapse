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

#include "NavigationProxy.h"

#include "DispatchEventBase.h"
#include "Frame.h"
#include "FrameLoadRequest.h"
#include "LoadURLRequest.h"
#include "ReloadFrame.h"
#include "StopLoadingFrame.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include <wtf/replay/InputIterator.h>

/* We must always define these symbols even if web replay support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with web replay support. */

namespace WebCore {

NavigationProxy::NavigationProxy(Page* page)
: ReplayProxy(page)
{}

PassOwnPtr<NavigationProxy> NavigationProxy::create(Page* page)
{
    return adoptPtr(new NavigationProxy(page));
}

void NavigationProxy::loadURLRequest(const FrameLoadRequest& request, bool fromReplay)
{
    #if ENABLE(WEB_REPLAY)
    if (!fromReplay && m_mode == Replaying)
        return;

    if (m_mode == Capturing)
        m_page->replayController().activeIterator()->storeInput(adoptPtr(new LoadURLRequest(request)));
#else
    UNUSED_PARAM(fromReplay);
#endif

    // do dispatch
    m_page->mainFrame().loader().load(request);
}

void NavigationProxy::reloadFrame(Frame* frame, bool endToEndReload, bool fromReplay)
{
    #if ENABLE(WEB_REPLAY)
    if (!fromReplay && m_mode == Replaying)
        return;

    if (m_mode == Capturing) {
        int frameIndex = SerializedEventTarget::frameIndexFromDocument(frame->document());
        m_page->replayController().activeIterator()->storeInput(adoptPtr(new ReloadFrame(endToEndReload, frameIndex)));
    }
#else
    UNUSED_PARAM(fromReplay);
#endif

    // do dispatch
    frame->loader().reload(endToEndReload);
}

void NavigationProxy::stopLoadingFrame(Frame* frame, bool fromReplay)
{
    #if ENABLE(WEB_REPLAY)
    if (!fromReplay && m_mode == Replaying)
        return;

    if (m_mode == Capturing) {
        int frameIndex = SerializedEventTarget::frameIndexFromDocument(frame->document());
        m_page->replayController().activeIterator()->storeInput(adoptPtr(new StopLoadingFrame(frameIndex)));
    }
#else
    UNUSED_PARAM(fromReplay);
#endif

    // do dispatch
    frame->loader().stopForUserCancel();
}

} // namespace WebCore
