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

#include "config.h"

#if ENABLE(TIMELAPSE)

#include "HandleKeyPress.h"

#include "Document.h"
#include "FrameCamera.h"
#include "Logging.h"
#include "ReplayController.h"
#include "Page.h"
#include "ReplayInputTypes.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/CString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include "InputEncoder.h"

namespace WebCore {

static String keyTypeToString(PlatformKeyboardEvent::Type ty)
{
    switch (ty) {
    case PlatformKeyboardEvent::KeyDown:     return "KeyDown";
    case PlatformKeyboardEvent::KeyUp:       return "KeyUp";
    case PlatformKeyboardEvent::RawKeyDown:  return "RawKeyDown";
    case PlatformKeyboardEvent::Char:        return "Char";
    default:
        ASSERT_NOT_REACHED();
        return String();
    }
}

String HandleKeyPress::toString() const
{
    StringBuilder sb;
    sb.append("HandleKeyPress(");
    sb.append(makeString("type=", keyTypeToString(m_platformEvent.type()), ";"));
    if (m_platformEvent.shiftKey() || m_platformEvent.ctrlKey() || m_platformEvent.altKey() || m_platformEvent.metaKey()) {
        sb.append(" key=[ ");
        if (m_platformEvent.shiftKey())
            sb.append("SHIFT ");
        if (m_platformEvent.ctrlKey())
            sb.append("CTRL ");
        if (m_platformEvent.altKey())
            sb.append("ALT ");
        if (m_platformEvent.metaKey())
            sb.append("META ");
        sb.append("];");
    }
    if (m_platformEvent.isAutoRepeat())
        sb.append(" autorepeat;");

    if (m_platformEvent.isKeypad())
        sb.append(" keypad;");

    sb.append(makeString("text=[", m_platformEvent.text(), "];"));
    sb.append(")");
    return sb.toString();
}

size_t HandleKeyPress::memorySize() const
{
    size_t size = sizeof(HandleKeyPress);
    size += (!m_platformEvent.text().isEmpty()) ? m_platformEvent.text().impl()->cost() : 0;
    size += (!m_platformEvent.unmodifiedText().isEmpty()) ? m_platformEvent.unmodifiedText().impl()->cost() : 0;
    size += (!m_platformEvent.keyIdentifier().isEmpty()) ? m_platformEvent.keyIdentifier().impl()->cost() : 0;
    return size;
}

void HandleKeyPress::serialize(InputEncoder& encoder) const
{
    encoder.pushObject();
    encoder.put("timestamp", m_platformEvent.timestamp());
    encoder.put("type", (int)m_platformEvent.type());
    encoder.put("modifiers", m_platformEvent.modifiers());
    encoder.put("text", m_platformEvent.text());
    encoder.put("unmodifiedText", m_platformEvent.unmodifiedText());
    encoder.put("keyIdentifier", m_platformEvent.keyIdentifier());
    encoder.put("windowsVirtualKeyCode", m_platformEvent.windowsVirtualKeyCode());
    encoder.put("nativeVirtualKeyCode", m_platformEvent.nativeVirtualKeyCode());
    encoder.put("macCharCode", m_platformEvent.macCharCode());
    encoder.put("autoRepeat", m_platformEvent.isAutoRepeat());
    encoder.put("keypad", m_platformEvent.isKeypad());
    encoder.put("systemKey", m_platformEvent.isSystemKey());
    encoder.popObjectAsProperty("keyEvent");
}

void HandleKeyPress::dispatch(ReplayController* controller,
                              EventLoopInputDispatcher* dispatcher)
{
    ASSERT(controller->page());
    ASSERT(sealed());

    const String& screenshotDataUri = FrameCamera::dataUriImageFromFrame(controller->page()->mainFrame());
    controller->imageCaptured(screenshotDataUri);

    controller->page()->userInputProxy()->handleKeyPressEvent(platformEvent(), true);
    dispatcher->didDispatch(this);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
