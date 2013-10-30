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

#include "CaptureInputIterator.h"
#include "FrameLoadRequest.h"
#include "LoadURLRequest.h"
#include "MainFrame.h"
#include "ReloadFrame.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "StopLoadingFrame.h"
#include "TryClosePage.h"
#include <wtf/replay/InputIterator.h>

/* We must always define these symbols even if web replay support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with web replay support. */

namespace WebCore {

NavigationProxy::NavigationProxy(Page& page)
: ReplayProxy(page)
{}

void NavigationProxy::loadURLRequest(const FrameLoadRequest& request, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<LoadURLRequest>(request));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.mainFrame().loader().load(request);
}

void NavigationProxy::reloadFrame(Frame* frame, bool endToEndReload, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        int frameIndex = frameIndexFromDocument(frame->document());
        it->storeInput(std::make_unique<ReloadFrame>(endToEndReload, frameIndex));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->loader().reload(endToEndReload);
}

void NavigationProxy::stopLoadingFrame(Frame* frame, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        int frameIndex = frameIndexFromDocument(frame->document());
        it->storeInput(std::make_unique<StopLoadingFrame>(frameIndex));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->loader().stopForUserCancel();
}

// This method is called directly from WebPage, when it needs to close a tab.
// It won't be called during normal navigations between main frames.
bool NavigationProxy::tryClosePage(bool fromReplay)
{
    bool allowed;
#if ENABLE(WEB_REPLAY)
    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        {
            ASSERT(mode() == Capturing);
            EventLoopInputExtent extent(m_page.replayController().activeIterator());
            allowed = m_page.mainFrame().loader().shouldClose();
        }
        
        // If the page doesn't stop the close, then stop recording. On replay,
        // the page will be torn down the same way whether it's closed or navigated.
        // We may end up logging an extra memoized input for the
        // beforeUnloadConfirmPanel result, but it should not affect replay.
        if (allowed)
            m_page.replayController().endCapturing();
        // If the page does stop the load, then we need to capture and later simulate
        // the attempt so that the memoized beforeUnloadConfirmPanel result is used.
        else
            it->storeInput(std::make_unique<TryClosePage>());

    } else if (it && it->isReplaying() && !fromReplay) {
        ASSERT(mode() == Replaying);
        // If the user closes the tab during replay, then we have no choice
        // but to stop replaying, because asking the user would cause nondeterminism.
        // Otherwise, it will continue using memoized beforeUnloadConfirmPanel result.
        m_page.replayController().cancelPlayback();
        return true;
    } else
#else
    UNUSED_PARAM(fromReplay);
#endif
    allowed = m_page.mainFrame().loader().shouldClose();
    return allowed;
}

} // namespace WebCore
