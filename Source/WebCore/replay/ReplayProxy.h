/*
 * Copyright (C) 2012, 2013 University of Washington. All rights reserved.
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

#ifndef ReplayProxy_h
#define ReplayProxy_h

#include "ScrollTypes.h"
#include <wtf/HashMap.h>
#include <wtf/Noncopyable.h>

#if ENABLE(PAGE_VISIBILITY_API)
#include "PageVisibilityState.h"
#endif

namespace WebCore {

struct FrameLoadRequest;

class Frame;
class Page;
class PlatformKeyboardEvent;
class PlatformMouseEvent;
class PlatformWheelEvent;
class ReplayableTimerBase;
class ReplayController;
class ResourceLoader;
class ResourceRequest;

class ReplayProxy {
    WTF_MAKE_NONCOPYABLE(ReplayProxy);
public:
    enum ProxyMode {
        Capturing,
        Open,
        Replaying,
    };

    ReplayProxy(Page&);
    virtual ~ReplayProxy();

    virtual void setMode(ProxyMode);
    ProxyMode mode() const { return m_mode; }

    // Networking APIs.
    unsigned long createUniqueIdentifier();
    // This is used to find differing ResourceRequest details during replay.
    unsigned long createUniqueIdentifierWithRequest(const ResourceRequest&);

#if ENABLE(WEB_REPLAY)
    // Async APIs.
    unsigned long registerTimer(ReplayableTimerBase*);
    void unregisterTimer(ReplayableTimerBase*);
    ReplayableTimerBase* findTimer(unsigned long identifier);
#endif

    // User input APIs.
    bool handleContextMenuEvent(const PlatformMouseEvent&, const Frame*, bool fromReplay = false);
    bool handleMousePressEvent(const PlatformMouseEvent&, bool fromReplay = false);
    bool handleMouseReleaseEvent(const PlatformMouseEvent&, bool fromReplay = false);
    bool handleMouseMoveEvent(const PlatformMouseEvent&, bool fromReplay = false);
    bool handleMouseMoveOnScrollbarEvent(const PlatformMouseEvent&, bool fromReplay = false);
    bool handleWheelEvent(const PlatformWheelEvent&, bool fromReplay = false);
    bool handleKeyPressEvent(const PlatformKeyboardEvent&, bool fromReplay = false);
    bool handleAccessKeyEvent(const PlatformKeyboardEvent&, bool fromReplay = false);
    void focusSetActive(bool active, bool fromReplay = false);
    void focusSetFocused(bool focused, bool fromReplay = false);
    bool scrollRecursively(ScrollDirection, ScrollGranularity, bool fromReplay = false);
    bool scrollRecursivelyLogical(ScrollLogicalDirection, ScrollGranularity, bool fromReplay = false);
    void sendResizeEvent(const Frame*, bool dispatchSynchronously, bool fromReplay = false);
#if ENABLE(PAGE_VISIBILITY_API)
    void setPageVisibility(PageVisibilityState, bool isInitialState, bool fromReplay = false);
#endif

    // Navigation APIs.
    void loadURLRequest(const FrameLoadRequest&, bool fromReplay = false);
    void reloadFrame(Frame*, bool endToEndReload, bool fromReplay = false);
    void stopLoadingFrame(Frame*, bool fromReplay = false);
    bool tryClosePage(bool fromReplay = false);

private:
    Page& m_page;
    ProxyMode m_mode;

    // For numbering resource loaders.
    unsigned long m_nextUniqueIdentifier;

#if ENABLE(WEB_REPLAY)
    // For numbering timers.
    unsigned long m_nextTimerIdentifier;
    typedef HashMap<unsigned long, ReplayableTimerBase*> TimerMap;
    TimerMap m_timerMap;
#endif
};

} // namespace WebCore

#endif // ReplayProxy_h
