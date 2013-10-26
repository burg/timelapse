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

#include "UserInputProxy.h"

#include "CaptureInputIterator.h"
#include "Document.h"
#include "DOMWindow.h"
#include "EventHandler.h"
#include "FocusController.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "HandleContextMenu.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "MainFrame.h"
#include "Page.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ReplayController.h"
#include "ReplayRecording.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include <wtf/PassOwnPtr.h>
#include <wtf/replay/InputIterator.h>

#if ENABLE(PAGE_VISIBILITY_API)
#include "SetPageVisibility.h"
#endif

/* We must always define these symbols even if web replay support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with web replay support. */

namespace WebCore {

UserInputProxy::UserInputProxy(Page& page)
: ReplayProxy(page) {}

bool UserInputProxy::handleContextMenuEvent(const PlatformMouseEvent& mouseEvent, const Frame* frame, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        int frameIndex = frameIndexFromDocument(frame->document());
        it->storeInput(std::make_unique<HandleContextMenu>(mouseEvent, frameIndex));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return frame->eventHandler().sendContextMenuEvent(mouseEvent);
}

bool UserInputProxy::handleMousePressEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleMousePress>(mouseEvent));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleMousePressEvent(mouseEvent);
}

bool UserInputProxy::handleMouseReleaseEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleMouseRelease>(mouseEvent));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleMouseReleaseEvent(mouseEvent);
}

bool UserInputProxy::handleMouseMoveEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleMouseMove>(mouseEvent, false));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().mouseMoved(mouseEvent);
}

bool UserInputProxy::handleMouseMoveOnScrollbarEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleMouseMove>(mouseEvent, true));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().passMouseMovedEventToScrollbars(mouseEvent);
}

bool UserInputProxy::handleKeyPressEvent(const PlatformKeyboardEvent& keyEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleKeyPress>(keyEvent));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().keyEvent(keyEvent);
}

bool UserInputProxy::handleAccessKeyEvent(const PlatformKeyboardEvent& keyEvent, bool /*fromReplay*/)
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

bool UserInputProxy::handleWheelEvent(const PlatformWheelEvent& wheelEvent, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return true;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<HandleWheelEvent>(wheelEvent));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.mainFrame().eventHandler().handleWheelEvent(wheelEvent);
}

void UserInputProxy::focusSetActive(bool active, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<FocusSetActive>(active));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.focusController().setActive(active);
}

void UserInputProxy::focusSetFocused(bool focused, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<FocusSetFocused>(focused));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.focusController().setFocused(focused);
}

bool UserInputProxy::scrollRecursively(ScrollDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return false;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<ScrollPage>(direction, granularity));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().scrollRecursively(direction, granularity, 0);
}

bool UserInputProxy::scrollRecursivelyLogical(ScrollLogicalDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return false;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<ScrollPage>(direction, granularity));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    return m_page.focusController().focusedOrMainFrame().eventHandler().logicalScrollRecursively(direction, granularity, static_cast<Node*>(0));
}

void UserInputProxy::sendResizeEvent(const Frame* frame, bool dispatchSynchronously, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    // On replay, whether it is synchronous or not doesn't matter because
    // the document event queue is always emptied before dispatching event loop inputs.
    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        int width = frame->document()->domWindow()->outerWidth();
        int height = frame->document()->domWindow()->outerHeight();
        int frameIndex = frameIndexFromDocument(frame->document());

        it->storeInput(std::make_unique<SendResizeEvent>(width, height, frameIndex));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    frame->eventHandler().sendResizeEvent(dispatchSynchronously);
}

#if ENABLE(PAGE_VISIBILITY_API)
void UserInputProxy::setPageVisibility(PageVisibilityState visibilityState, bool isInitialState, bool fromReplay)
{
#if ENABLE(WEB_REPLAY)
    if (!fromReplay && mode() == Replaying)
        return;

    InputIterator* it = m_page.replayController().activeIterator();
    if (it && it->isCapturing()) {
        ASSERT(mode() == Capturing);
        it->storeInput(std::make_unique<SetPageVisibility>(visibilityState, isInitialState));
    }
    EventLoopInputExtent extent(it);
#else
    UNUSED_PARAM(fromReplay);
#endif

    m_page.setVisibilityState(visibilityState, isInitialState);
}
#endif

} // namespace WebCore
