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

// This file is the include equivalent for REPLAY_INPUT_TYPES_FOR_EACH.
// Note that there is not an exact correspondence between the two, since
// Some input types reside in the same file.

// Make sure that this list stays up to date with ReplayInputTypes.h.

#ifndef AllReplayInputs_h
#define AllReplayInputs_h

#if ENABLE(WEB_REPLAY)

// WebCore inputs.

#include "AsyncTimerFired.h"
#include "AutoMemoized.h"
#include "DisableCache.h"
#include "DispatchFakeMouseMove.h"
#include "EnableCache.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "HandleContextMenu.h"
#include "HandleKeyPress.h"
#include "HandleMouseMove.h"
#include "HandleMousePress.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "InitializeFocus.h"
#include "InitializeWindow.h"
#include "LoadURLRequest.h"
#include "NavigateToPage.h"
#include "PlaybackError.h"
#include "RanPendingScripts.h"
#include "ReloadFrame.h"
#include "ResourceDidFail.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceDidSendData.h"
#include "ResourceLoaderCreated.h"
#include "ScrollPage.h"
#include "SendPendingEvents.h"
#include "SendResizeEvent.h"
#include "SentinelActions.h"
#include "SetPageVisibility.h"
#include "StopLoadingFrame.h"
#include "DOMTimerCreated.h"
#include "DOMTimerFired.h"
#include "TryClosePage.h"

// JSC inputs.

#include <replay/GetCurrentTime.h>
#include <replay/SetRandomSeed.h>

using JSC::GetCurrentTime;
using JSC::SetRandomSeed;

// Feature- or platform-specific inputs.

#if PLATFORM(MAC)
#include "InterpretedKeyCommands.h"
#endif

#endif // ENABLE(WEB_REPLAY)

#endif // AllReplayInputs_h
