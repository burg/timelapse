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

#include "HandleMouseBase.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "PlatformMouseEvent.h"
#include "ReplayInputTypes.h"
#include <wtf/Assertions.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

String HandleMouseBase::toString() const
{
    StringBuilder sb;
    sb.append(makeString("HandleMouse",
                         mouseEventTypeToString(m_platformEvent.type()), "("));
    sb.append(makeString("pagePos=[", String::number(m_platformEvent.position().x()), ",", String::number(m_platformEvent.position().y()), "];"));
    sb.append(makeString(" globalPos=[", String::number(m_platformEvent.globalPosition().x()), ",", String::number(m_platformEvent.globalPosition().y()), "];"));
    if (m_platformEvent.shiftKey() || m_platformEvent.ctrlKey() || m_platformEvent.altKey() || m_platformEvent.metaKey()) {
        sb.append("key=[ ");
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
    sb.append(makeString("flags=", String::number(m_platformEvent.modifierFlags()), ";"));
    sb.append(makeString("ts=", String::number(m_platformEvent.timestamp()), ";"));
    sb.append(makeString("button=", mouseButtonToString(m_platformEvent.button()), ";"));
    sb.append(")");
    return sb.toString();
}

String HandleMouseBase::mouseButtonToString(MouseButton button)
{
    switch (button) {
    case NoButton:       return "None";
    case LeftButton:     return "LeftButton";
    case MiddleButton:   return "MiddleButton";
    case RightButton:    return "RightButton";
    default:
        ASSERT_NOT_REACHED();
        return String();
    }
}

String HandleMouseBase::mouseEventTypeToString(PlatformEvent::Type type)
{
    switch (type) {
    case PlatformEvent::MouseMoved:     return "Move";
    case PlatformEvent::MousePressed:   return "Press";
    case PlatformEvent::MouseReleased:  return "Release";
    case PlatformEvent::MouseScroll:    return "Scroll";
    default:
        ASSERT_NOT_REACHED();
        return String();
    }
}

void InputCoder<PlatformMouseEvent>::encode(EncoderContext& encoder, const PlatformMouseEvent& input)
{
    encoder.put("positionX", input.position().x());
    encoder.put("positionY", input.position().y());
    encoder.put("globalPositionX", input.globalPosition().x());
    encoder.put("globalPositionY", input.globalPosition().y());
    encoder.put("mouseButton", (uint64_t)input.button());
    encoder.put("type", (uint64_t)input.type());
    encoder.put("clickCount", input.clickCount());
    encoder.put("shiftKey", input.shiftKey());
    encoder.put("ctrlKey", input.ctrlKey());
    encoder.put("altKey", input.altKey());
    encoder.put("metaKey", input.metaKey());
    encoder.put("timestamp", input.timestamp());
}

bool InputCoder<PlatformMouseEvent>::decode(DecoderContext& decoder, OwnPtr<PlatformMouseEvent>& input)
{
    int positionX;
    if (!decoder.get("positionX", positionX))
        return false;

    int positionY;
    if (!decoder.get("positionY", positionY))
        return false;

    int globalPositionX;
    if (!decoder.get("globalPositionX", globalPositionX))
        return false;

    int globalPositionY;
    if (!decoder.get("globalPositionY", globalPositionY))
        return false;

    uint64_t button;
    if (!decoder.get("button", button))
        return false;

    uint64_t type;
    if (!decoder.get("type", type))
        return false;

    int clickCount;
    if (!decoder.get("clickCount", clickCount))
        return false;

    bool shiftKey;
    if (!decoder.get("shiftKey", shiftKey))
        return false;

    bool ctrlKey;
    if (!decoder.get("ctrlKey", ctrlKey))
        return false;

    bool altKey;
    if (!decoder.get("altKey", altKey))
        return false;

    bool metaKey;
    if (!decoder.get("metaKey", metaKey))
        return false;

    int timestamp;
    if (!decoder.get("timestamp", timestamp))
        return false;

    input = adoptPtr(new PlatformMouseEvent(IntPoint(positionX, positionY),
                                            IntPoint(globalPositionX, globalPositionY),
                                            (MouseButton)button, (PlatformEvent::Type)type,
                                            clickCount,
                                            shiftKey, ctrlKey, altKey, metaKey, timestamp));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
