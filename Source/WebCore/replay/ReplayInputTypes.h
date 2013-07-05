/*
 * Copyright (C) 2013, University of Washington. All rights reserved.
 * Copyright (C) 2005, 2007 Apple Inc. All rights reserved.
 * Copyright (C) 2006 Jon Shier (jshier@iastate.edu)
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 *
 */

#ifndef ReplayInputTypes_h
#define ReplayInputTypes_h

#include "ThreadGlobalData.h"
#include <wtf/text/AtomicString.h>

#if ENABLE(WEB_REPLAY)

namespace WebCore {

#define REPLAY_INPUT_TYPES_FOR_EACH(macro) \
    macro(AutoMemoized) \
    macro(BeginSentinel) \
    macro(DisableCache) \
    macro(DispatchFakeMouseMove) \
    macro(DispatchAsyncEvent) \
    macro(EnableCache) \
    macro(EndSentinel) \
    macro(FocusSetActive) \
    macro(FocusSetFocused) \
    macro(HandleContextMenu) \
    macro(HandleKeyPress) \
    macro(HandleMouseMove) \
    macro(HandleMousePress) \
    macro(HandleMouseRelease) \
    macro(HandleWheelEvent) \
    macro(InitializeFocus) \
    macro(InitializeWindow) \
    macro(InterpretedKeyCommands) \
    macro(NavigateToPage) \
    macro(PlaybackError) \
    macro(RanPendingScripts) \
    macro(ResourceCannotShowURL) \
    macro(ResourceDidFail) \
    macro(ResourceDidFinishLoading) \
    macro(ResourceDidReceiveData) \
    macro(ResourceDidReceiveResponse) \
    macro(ResourceDidSendData) \
    macro(ResourceLoaderCreated) \
    macro(ResourceLoaderDestroyed) \
    macro(ResourceWasBlocked) \
    macro(ResourceWillSendRequest) \
    macro(ScrollPage) \
    macro(SendResizeEvent) \
    macro(TimerCreated) \
    macro(TimerFired) \
    \
// end of REPLAY_INPUT_TYPES_FOR_EACH

class ReplayInputTypes {
    WTF_MAKE_NONCOPYABLE(ReplayInputTypes); WTF_MAKE_FAST_ALLOCATED;
    int dummy; // Needed to make initialization macro work.
    // Private to prevent accidental call to ReplayInputTypes() instead of replayInputTypes()
    ReplayInputTypes();
    friend class ThreadGlobalData;

public:
    #define REPLAY_INPUT_TYPES_DECLARE(name) AtomicString name;
    REPLAY_INPUT_TYPES_FOR_EACH(REPLAY_INPUT_TYPES_DECLARE)
    #undef REPLAY_INPUT_TYPES_DECLARE
};

inline ReplayInputTypes& inputTypes()
{
    return threadGlobalData().inputTypes();
}

} // namespace Webcore

#endif // ENABLE(WEB_REPLAY)

#endif // ReplayInputTypes_h
