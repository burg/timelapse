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

#include "DeterminismController.h"
#include "EventHandler.h"
#include "FocusController.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "Frame.h"
#include "HandleContextMenu.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "Page.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include <wtf/PassOwnPtr.h>

/* We must always define these symbols even if Timelapse support is
   not compiled, because the embedding API (WebKit or WebKit2) may be
   built with Timelapse support. */

namespace WebCore {

UserInputProxy::UserInputProxy(Page* page)
: TimelapseProxy(page) {}

PassOwnPtr<UserInputProxy> UserInputProxy::create(Page* page)
{
    return adoptPtr(new UserInputProxy(page));
}

bool UserInputProxy::handleContextMenuEvent(const PlatformMouseEvent& mouseEvent, const Frame* frame, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;

    if (m_mode == Capturing && m_page->determinismController()) {
        HandleContextMenu* action = new HandleContextMenu(mouseEvent, frame);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return frame->eventHandler()->sendContextMenuEvent(mouseEvent);
}

bool UserInputProxy::handleMousePressEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleMousePress* action = new HandleMousePress(mouseEvent);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->mainFrame()->eventHandler()->handleMousePressEvent(mouseEvent);
}

bool UserInputProxy::handleMouseReleaseEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleMouseRelease* action = new HandleMouseRelease(mouseEvent);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->mainFrame()->eventHandler()->handleMouseReleaseEvent(mouseEvent);
}

bool UserInputProxy::handleMouseMoveEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleMouseMove* action = new HandleMouseMove(mouseEvent, false);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->mainFrame()->eventHandler()->mouseMoved(mouseEvent);
}

bool UserInputProxy::handleMouseMoveOnScrollbarEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleMouseMove* action = new HandleMouseMove(mouseEvent, true);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->mainFrame()->eventHandler()->passMouseMovedEventToScrollbars(mouseEvent);
}

bool UserInputProxy::handleKeyPressEvent(const PlatformKeyboardEvent& keyEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleKeyPress* action = new HandleKeyPress(keyEvent);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->focusController()->focusedOrMainFrame()->eventHandler()->keyEvent(keyEvent);
}

bool UserInputProxy::handleAccessKeyEvent(const PlatformKeyboardEvent& keyEvent, bool /*fromReplay*/)
{
/*#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleKeyPress* action = new HandleKeyPress(mouseEvent);
        m_page->determinismController()->capturePageInput(action);
    }
#endif*/

    // do dispatch
    return m_page->focusController()->focusedOrMainFrame()->eventHandler()->handleAccessKey(keyEvent);
}

bool UserInputProxy::handleWheelEvent(const PlatformWheelEvent& wheelEvent, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return true;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        HandleWheelEvent* action = new HandleWheelEvent(wheelEvent);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    // do dispatch
    return m_page->mainFrame()->eventHandler()->handleWheelEvent(wheelEvent);
}

void UserInputProxy::focusSetActive(bool active, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        FocusSetActive* action = new FocusSetActive(active);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    m_page->focusController()->setActive(active);
}

void UserInputProxy::focusSetFocused(bool focused, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        FocusSetFocused* action = new FocusSetFocused(focused);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    m_page->focusController()->setFocused(focused);
}

void UserInputProxy::scrollRecursively(ScrollDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        ScrollPage* action = new ScrollPage(direction, granularity);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    m_page->focusController()->focusedOrMainFrame()->eventHandler()->scrollRecursively(direction, granularity, 0);
}

void UserInputProxy::scrollRecursivelyLogical(ScrollLogicalDirection direction, ScrollGranularity granularity, bool fromReplay)
{
#if ENABLE(TIMELAPSE)
    if (!fromReplay && m_mode == Replaying)
        return;
        
    if (m_mode == Capturing && m_page->determinismController()) {
        ScrollPage* action = new ScrollPage(direction, granularity);
        m_page->determinismController()->capturePageInput(action);
    }
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    m_page->focusController()->focusedOrMainFrame()->eventHandler()->logicalScrollRecursively(direction, granularity, static_cast<Node*>(0));
}        

void UserInputProxy::sendResizeEvent(const Frame* frame, bool fromReplay)
    {
#if ENABLE(TIMELAPSE)
        if (!fromReplay && m_mode == Replaying)
            return;
        
        if (m_mode == Capturing && m_page->determinismController()) {
            SendResizeEvent* action = new SendResizeEvent(frame);
            m_page->determinismController()->capturePageInput(action);
        }
#else
        UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)
        
        frame->eventHandler()->sendResizeEvent();
    }

} // namespace WebCore

