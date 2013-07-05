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

#if ENABLE(WEB_REPLAY)

#include "HandleKeyPress.h"

#include "Document.h"
#include "FrameCamera.h"
#include "InputDecoder.h"
#include "InputEncoder.h"
#include "Logging.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/CString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

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

const AtomicString& HandleKeyPress::type() const
{
    return inputTypes().HandleKeyPress;
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

void InputCoder<PlatformKeyboardEvent>::encode(InputEncoder& encoder, const PlatformKeyboardEvent& input)
{
    encoder.put("timestamp", input.timestamp());
    encoder.put("type", (uint64_t)input.type());
    encoder.put("modifiers", input.modifiers());
    encoder.put("text", input.text());
    encoder.put("unmodifiedText", input.unmodifiedText());
    encoder.put("keyIdentifier", input.keyIdentifier());
    encoder.put("windowsVirtualKeyCode", input.windowsVirtualKeyCode());
    encoder.put("nativeVirtualKeyCode", input.nativeVirtualKeyCode());
    encoder.put("macCharCode", input.macCharCode());
    encoder.put("autoRepeat", input.isAutoRepeat());
    encoder.put("keypad", input.isKeypad());
    encoder.put("systemKey", input.isSystemKey());
}

bool InputCoder<PlatformKeyboardEvent>::decode(InputDecoder& decoder, OwnPtr<PlatformKeyboardEvent>& input)
{
    double timestamp;
    if (!decoder.get("timestamp", timestamp))
        return false;

    uint64_t type;
    if (!decoder.get("type", type))
        return false;

    uint64_t modifiers;
    if (!decoder.get("modifiers", modifiers))
        return false;

    String text;
    if (!decoder.get("text", text))
        return false;

    String unmodifiedText;
    if (!decoder.get("unmodifiedText", unmodifiedText))
        return false;

    String keyIdentifier;
    if (!decoder.get("keyIdentifier", keyIdentifier))
        return false;

    int windowsVirtualKeyCode;
    if (!decoder.get("windowsVirtualKeyCode", windowsVirtualKeyCode))
        return false;

    int nativeVirtualKeyCode;
    if (!decoder.get("nativeVirtualKeyCode", nativeVirtualKeyCode))
        return false;

    int macCharCode;
    if (!decoder.get("macCharCode", macCharCode))
        return false;

    bool isAutoRepeat;
    if (!decoder.get("autoRepeat", isAutoRepeat))
        return false;

    bool isKeypad;
    if (!decoder.get("keypad", isKeypad))
        return false;

    bool isSystemKey;
    if (!decoder.get("systemKey", isSystemKey))
        return false;

    input = adoptPtr(new PlatformKeyboardEvent((PlatformKeyboardEvent::Type)type, text, unmodifiedText, keyIdentifier, windowsVirtualKeyCode, nativeVirtualKeyCode, macCharCode, isAutoRepeat, isKeypad, isSystemKey, (PlatformEvent::Modifiers)modifiers, timestamp));
    return true;
}

void InputCoder<HandleKeyPress>::encode(InputEncoder& encoder, const HandleKeyPress& input)
{
    InputCoder<PlatformKeyboardEvent>::encode(encoder, input.platformEvent());
}

bool InputCoder<HandleKeyPress>::decode(InputDecoder& decoder, OwnPtr<HandleKeyPress>& input)
{
    OwnPtr<PlatformKeyboardEvent> keyEvent;
    if (!InputCoder<PlatformKeyboardEvent>::decode(decoder, keyEvent))
        return false;

    input = adoptPtr(new HandleKeyPress(*keyEvent));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
