/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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

#ifndef ReplayableTypes_h
#define ReplayableTypes_h

#if ENABLE(TIMELAPSE)

namespace WebCore {

namespace ReplayableTypes {
extern const char* AutoMemoized;
extern const char* BeginSentinel;
extern const char* FocusSetActive;
extern const char* FocusSetFocused;
extern const char* DisableCache;
extern const char* DispatchAsyncEvent;
extern const char* EnableCache;
extern const char* EndSentinel;
extern const char* HandleAccessKey;
extern const char* HandleContextMenu;
extern const char* HandleKeyPress;
extern const char* HandleMouseMove;
extern const char* HandleMousePress;
extern const char* HandleMouseRelease;
extern const char* HandleWheelEvent;
extern const char* InitializeFocus;
extern const char* InitializeWindow;
extern const char* ReceivedResourceResponse;
extern const char* NavigateToPage;
extern const char* PlaybackError;
extern const char* RanPendingScripts;
extern const char* ScrollPage;
extern const char* SendResizeEvent;
extern const char* SetCookieSeed;
extern const char* TimerCreated;
extern const char* TimerFired;
} // namespace ReplayableTypes

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // ReplayableTypes_h
