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

#if ENABLE(WEB_REPLAY)

#include "HandleWheelEvent.h"

#include "InputDecoder.h"
#include "InputEncoder.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include "InputEncoder.h"

namespace WebCore {

static String wheelEventGranularityToString(PlatformWheelEventGranularity ty)
{
    switch (ty) {
    case ScrollByPageWheelEvent:  return "ScrollByPage";
    case ScrollByPixelWheelEvent: return "ScrollByPixel";

    default:
        ASSERT_NOT_REACHED();
        return String();
    }
}

#if PLATFORM(MAC)
static String wheelEventPhaseToString(PlatformWheelEventPhase ty)
{
    switch (ty) {
    case PlatformWheelEventPhaseNone:       return "None";
    case PlatformWheelEventPhaseBegan:      return "Began";
    case PlatformWheelEventPhaseStationary: return "Stationary";
    case PlatformWheelEventPhaseChanged:    return "Changed";
    case PlatformWheelEventPhaseEnded:      return "Ended";
    case PlatformWheelEventPhaseCancelled:  return "Cancelled";

    default:
        ASSERT_NOT_REACHED();
        return String();
    }
}
#endif

const AtomicString& HandleWheelEvent::type() const
{
    return inputTypes().HandleWheelEvent;
}

String HandleWheelEvent::toString() const
{
    StringBuilder sb;
    sb.append("HandleWheelEvent(");
    sb.append(makeString("pagePos=[",
                         String::number(m_platformEvent.position().x()),
                         ",",
                         String::number(m_platformEvent.position().y()),
                         "];"));
    sb.append(makeString(" globalPos=[",
                         String::number(m_platformEvent.globalPosition().x()),
                         ",",
                         String::number(m_platformEvent.globalPosition().y()),
                         "];"));

    sb.append(makeString(" delta=[",
                         String::number(m_platformEvent.deltaX()),
                         ",",
                         String::number(m_platformEvent.deltaY()),
                         "];"));


    sb.append(makeString(" wheelTicksX=", String::number(m_platformEvent.wheelTicksX()), ";"));
    sb.append(makeString(" wheelTicksY=", String::number(m_platformEvent.wheelTicksY()), ";"));

    sb.append(makeString(" granularity=", wheelEventGranularityToString(m_platformEvent.granularity()), ";"));

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

    sb.append(makeString(" inverted from device: ", (m_platformEvent.directionInvertedFromDevice()) ? "true" : "false", ";"));

#if PLATFORM(MAC)
    sb.append(makeString(" phase=", wheelEventPhaseToString(m_platformEvent.phase()), ";"));
    sb.append(makeString(" momentumPhase=", wheelEventPhaseToString(m_platformEvent.momentumPhase()), ";"));
    sb.append(makeString(" PreciseScrollDeltas=", (m_platformEvent.hasPreciseScrollingDeltas()) ? "true" : "false", ";"));
    sb.append(makeString(" ts=", String::number(m_platformEvent.timestamp()), ";"));
#endif
    sb.append(")");
    return sb.toString();
}

void HandleWheelEvent::dispatch(ReplayController* controller,
                                EventLoopInputDispatcher* dispatcher)
{
    ASSERT(controller->page());
    ASSERT(sealed());

    controller->page()->userInputProxy()->handleWheelEvent(const_cast<PlatformWheelEvent&>(platformEvent()), true);
    dispatcher->didDispatch(this);
}

size_t HandleWheelEvent::memorySize() const
{
    return sizeof(HandleWheelEvent);
}

void InputCoder<PlatformWheelEvent>::encode(InputEncoder& encoder, const PlatformWheelEvent& input)
{
    encoder.put("positionX", input.position().x());
    encoder.put("positionY", input.position().y());
    encoder.put("globalPositionX", input.globalPosition().x());
    encoder.put("globalPositionY", input.globalPosition().y());
    encoder.put("shiftKey", input.shiftKey());
    encoder.put("ctrlKey", input.ctrlKey());
    encoder.put("altKey", input.altKey());
    encoder.put("metaKey", input.metaKey());
    encoder.put("deltaX", input.deltaX());
    encoder.put("deltaY", input.deltaY());
    encoder.put("wheelTicksX", input.wheelTicksX());
    encoder.put("wheelTicksY", input.wheelTicksY());
    encoder.put("granularity", (uint64_t)input.granularity());
    encoder.put("directionInvertedFromDevice", input.directionInvertedFromDevice());
    encoder.put("timestamp", input.timestamp());
#if PLATFORM(MAC)
    encoder.put("hasPreciseScrollingDeltas", input.hasPreciseScrollingDeltas());
    encoder.put("phase", (uint64_t)input.phase());
    encoder.put("momentumPhase", (uint64_t)input.momentumPhase());
    encoder.put("scrollCount", input.scrollCount());
    encoder.put("unacceleratedScrollingDeltaX", input.unacceleratedScrollingDeltaX());
    encoder.put("unacceleratedScrollingDeltaY", input.unacceleratedScrollingDeltaY());
#endif
}

bool InputCoder<PlatformWheelEvent>::decode(InputDecoder& decoder, OwnPtr<PlatformWheelEvent>& input)
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

    float deltaX;
    if (!decoder.get("deltaX", deltaX))
        return false;

    float deltaY;
    if (!decoder.get("deltaY", deltaY))
        return false;

    float wheelTicksX;
    if (!decoder.get("wheelTicksX", wheelTicksX))
        return false;

    float wheelTicksY;
    if (!decoder.get("wheelTicksY", wheelTicksY))
        return false;

    uint64_t granularity;
    if (!decoder.get("granularity", granularity))
        return false;

    bool directionInvertedFromDevice;
    if (!decoder.get("directionInvertedFromDevice", directionInvertedFromDevice))
        return false;

    double timestamp;
    if (!decoder.get("timestamp", timestamp))
        return false;

#if PLATFORM(MAC)
    bool hasPreciseScrollingDeltas;
    if (!decoder.get("hasPreciseScrollingDeltas", hasPreciseScrollingDeltas))
        return false;

    uint64_t phase;
    if (!decoder.get("phase", phase))
        return false;

    uint64_t momentumPhase;
    if (!decoder.get("momentumPhase", momentumPhase))
        return false;

    int scrollCount;
    if (!decoder.get("scrollCount", scrollCount))
        return false;

    float unacceleratedScrollingDeltaX;
    if (!decoder.get("unacceleratedScrollingDeltaX", unacceleratedScrollingDeltaX))
        return false;

    float unacceleratedScrollingDeltaY;
    if (!decoder.get("unacceleratedScrollingDeltaY", unacceleratedScrollingDeltaY))
        return false;
#endif

    input = adoptPtr(new PlatformWheelEvent(IntPoint(positionX, positionY), IntPoint(globalPositionX, globalPositionY),
                     deltaX, deltaY, wheelTicksX, wheelTicksY, (PlatformWheelEventGranularity)granularity,
                     shiftKey, ctrlKey, altKey, metaKey, directionInvertedFromDevice
#if PLATFORM(MAC)
                     , hasPreciseScrollingDeltas,
                     (PlatformWheelEventPhase)phase, (PlatformWheelEventPhase)momentumPhase, timestamp,
                     unacceleratedScrollingDeltaX, unacceleratedScrollingDeltaY
#endif
            ));
    return true;
}

void InputCoder<HandleWheelEvent>::encode(InputEncoder& encoder, const HandleWheelEvent& input)
{
    InputCoder<PlatformWheelEvent>::encode(encoder, input.platformEvent());
}

bool InputCoder<HandleWheelEvent>::decode(InputDecoder& decoder, OwnPtr<HandleWheelEvent>& input)
{
    OwnPtr<PlatformWheelEvent> wheelEvent;
    if (!InputCoder<PlatformWheelEvent>::decode(decoder, wheelEvent))
        return false;

    input = adoptPtr(new HandleWheelEvent(*wheelEvent));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
