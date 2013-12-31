/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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
#include "ReplayProxy.h"

#include "DOMWindow.h"
#include "Document.h"
#include "Event.h"
#include "EventHandler.h"
#include "FocusController.h"
#include "Frame.h"
#include "FrameLoadRequest.h"
#include "MainFrame.h"
#include "Node.h"
#include "Page.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ResourceLoader.h"
#include "ResourceRequest.h"

#if ENABLE(WEB_REPLAY)
// For EventLoopInputExtent.
#include "CaptureInputIterator.h"
// For frameIndexFromFrame.
#include "EventLoopInput.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "HandleContextMenu.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "JSONEncoderContext.h"
#include "LoadURLRequest.h"
#include "Logging.h"
#include "ReloadFrame.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ReplayRecording.h"
#include "ResourceLoaderCreated.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "SerializationMethods.h"
#include "StopLoadingFrame.h"
#include "TryClosePage.h"
#include <wtf/replay/InputIterator.h>
#include <wtf/text/CString.h>

#if ENABLE(PAGE_VISIBILITY_API)
#include "SetPageVisibility.h"
#endif

#endif // ENABLE(WEB_REPLAY)

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

ReplayProxy::ReplayProxy(Page& page)
    : m_page(page)
    , m_mode(Open)
    , m_nextUniqueIdentifier(1)
{
}

ReplayProxy::~ReplayProxy()
{
}

void ReplayProxy::setMode(ProxyMode mode)
{
    ASSERT(mode != m_mode);
    m_mode = mode;
    m_nextUniqueIdentifier = 1;
}

unsigned long ReplayProxy::createUniqueIdentifier()
{
    return m_nextUniqueIdentifier++;
}

unsigned long ReplayProxy::createUniqueIdentifierWithRequest(const ResourceRequest& request)
{
    // This mechanism is only designed for error checking, in particular the
    // case where we create resource loaders in an different order during replay.
    unsigned long identifier = createUniqueIdentifier();
#if ENABLE(WEB_REPLAY)
    ReplayController& controller = m_page.replayController();
    if (mode() == Capturing)
        controller.activeIterator()->storeInput(std::make_unique<ResourceLoaderCreated>(identifier, request));

    if (mode() == Replaying) {
        ResourceLoaderCreated* memoizedData = static_cast<ResourceLoaderCreated*>(controller.activeIterator()->loadInput(NondeterministicInput::LoaderMemoizedDataQueue, inputTypes().ResourceLoaderCreated));
        unsigned long memoizedIdentifier = memoizedData ? memoizedData->identifier() : 0;
        bool failed = true;

        if (!memoizedData)
            controller.playbackError(false, "Memoized network request details were missing.");
        else if (!ResourceRequestBase::compare(memoizedData->request(), request)) {
            controller.playbackError(false, "Network request details differ from request observed when recording.");
            failed = true;
            LOG(DeterministicReplay, "Memoized request information:");
            printResourceRequestDiagnostics(memoizedData->request());
        } else if (memoizedIdentifier != identifier)
            controller.playbackError(false, String::format("Different number of identifiers created on capture and replay. (memoized: %lu, actual %lu)", memoizedIdentifier, identifier));
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

bool ReplayProxy::handleContextMenuEvent(const PlatformMouseEvent& mouseEvent, const Frame* frame, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleContextMenu>(mouseEvent, frameIndexFromFrame(frame)));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return frame->eventHandler().sendContextMenuEvent(mouseEvent);
}

bool ReplayProxy::handleMousePressEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleMousePress>(mouseEvent));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleMousePressEvent(mouseEvent);
}

bool ReplayProxy::handleMouseReleaseEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleMouseRelease>(mouseEvent));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleMouseReleaseEvent(mouseEvent);
}

bool ReplayProxy::handleMouseMoveEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleMouseMove>(mouseEvent, false));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().mouseMoved(mouseEvent);
}

bool ReplayProxy::handleMouseMoveOnScrollbarEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleMouseMove>(mouseEvent, true));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().passMouseMovedEventToScrollbars(mouseEvent);
}

bool ReplayProxy::handleKeyPressEvent(const PlatformKeyboardEvent& keyEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleKeyPress>(keyEvent));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().keyEvent(keyEvent);
}

bool ReplayProxy::handleAccessKeyEvent(const PlatformKeyboardEvent& keyEvent, bool /*fromReplay*/)
{
/*#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    if (mode() == Capturing)
        m_page.replayController().activeIterator()->storeInput(adoptPtr(new HandleKeyPress(mouseEvent)));
#endif*/

    // do dispatch
    return m_page.focusController().focusedOrMainFrame().eventHandler().handleAccessKey(keyEvent);
}

bool ReplayProxy::handleWheelEvent(const PlatformWheelEvent& wheelEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<HandleWheelEvent>(wheelEvent));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleWheelEvent(wheelEvent);
}

void ReplayProxy::focusSetActive(bool active, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<FocusSetActive>(active));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.focusController().setActive(active);
}

void ReplayProxy::focusSetFocused(bool focused, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<FocusSetFocused>(focused));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.focusController().setFocused(focused);
}

bool ReplayProxy::scrollRecursively(ScrollDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return false;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<ScrollPage>(direction, granularity));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().scrollRecursively(direction, granularity, 0);
}

bool ReplayProxy::scrollRecursivelyLogical(ScrollLogicalDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return false;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<ScrollPage>(direction, granularity));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().logicalScrollRecursively(direction, granularity, static_cast<Node*>(0));
}

void ReplayProxy::sendResizeEvent(const Frame* frame, bool dispatchSynchronously, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    // On replay, whether it is synchronous or not doesn't matter because
    // the document event queue is always emptied before dispatching event loop inputs.
    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        int width = frame->document()->domWindow()->outerWidth();
        int height = frame->document()->domWindow()->outerHeight();
        it->storeInput(std::make_unique<SendResizeEvent>(width, height, frameIndexFromFrame(frame)));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->eventHandler().sendResizeEvent(dispatchSynchronously);
}

#if ENABLE(PAGE_VISIBILITY_API)
void ReplayProxy::setPageVisibility(PageVisibilityState visibilityState, bool isInitialState, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<SetPageVisibility>(visibilityState, isInitialState));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.setVisibilityState(visibilityState, isInitialState);
}
#endif

void ReplayProxy::loadURLRequest(const FrameLoadRequest& request, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<LoadURLRequest>(request));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.mainFrame().loader().load(request);
}

void ReplayProxy::reloadFrame(Frame* frame, bool endToEndReload, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<ReloadFrame>(endToEndReload, frameIndexFromFrame(frame)));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->loader().reload(endToEndReload);
}

void ReplayProxy::stopLoadingFrame(Frame* frame, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing())
        it->storeInput(std::make_unique<StopLoadingFrame>(frameIndexFromFrame(frame)));
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->loader().stopForUserCancel();
}

// This method is called directly from WebPage, when it needs to close a tab.
// It won't be called during normal navigations between main frames.
bool ReplayProxy::tryClosePage(bool fromReplay)
{
    bool allowed;
#if ENABLE(WEB_REPLAY)
    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        {
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
