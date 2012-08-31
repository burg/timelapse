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

#ifndef UserInputProxy_h
#define UserInputProxy_h

#include "ScrollTypes.h"
#include "TimelapseProxy.h"
#include <wtf/RefPtr.h>
#include <wtf/Forward.h>
#include <wtf/Noncopyable.h>

namespace WebCore {

class Page;
class PlatformKeyboardEvent;
class PlatformMouseEvent;
class PlatformWheelEvent;

class UserInputProxy : public TimelapseProxy {
    WTF_MAKE_NONCOPYABLE(UserInputProxy);
    WTF_MAKE_FAST_ALLOCATED;

public:
    static PassOwnPtr<UserInputProxy> create(Page*);
    virtual ~UserInputProxy() {}

    bool handleContextMenuEvent(const PlatformMouseEvent& mouseEvent, const Frame* frame, bool fromReplay = false);
    bool handleMousePressEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay = false);
    bool handleMouseReleaseEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay = false);
    bool handleMouseMoveEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay = false);
    bool handleMouseMoveOnScrollbarEvent(const PlatformMouseEvent& mouseEvent, bool fromReplay = false);
    bool handleWheelEvent(const PlatformWheelEvent& wheelEvent, bool fromReplay = false);
    bool handleKeyPressEvent(const PlatformKeyboardEvent& keyEvent, bool fromReplay = false);
    bool handleAccessKeyEvent(const PlatformKeyboardEvent& keyEvent, bool fromReplay = false);
    void focusSetActive(bool active, bool fromReplay = false);
    void focusSetFocused(bool focused, bool fromReplay = false);
    void scrollRecursively(ScrollDirection, ScrollGranularity, bool fromReplay = false);
    void scrollRecursivelyLogical(ScrollLogicalDirection, ScrollGranularity, bool fromReplay = false);
    void sendResizeEvent(const Frame* frame, bool fromReplay = false);

private:
    UserInputProxy(Page*);
};
    
} // namespace WebCore

#endif // UserInputProxy_h
