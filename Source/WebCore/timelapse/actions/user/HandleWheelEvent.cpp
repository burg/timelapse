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
#if ENABLE(TIMELAPSE)

#include "HandleWheelEvent.h"

#include "DeterminismController.h"
#include "Page.h"
#include "ReplayableTypes.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

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

#if PLATFORM(MAC) || (PLATFORM(CHROMIUM) && OS(DARWIN))
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

#if PLATFORM(MAC) || (PLATFORM(CHROMIUM) && OS(DARWIN))
    sb.append(makeString(" phase=", wheelEventPhaseToString(m_platformEvent.phase()), ";"));
    sb.append(makeString(" momentumPhase=", wheelEventPhaseToString(m_platformEvent.momentumPhase()), ";"));
    sb.append(makeString(" PreciseScrollDeltas=", (m_platformEvent.hasPreciseScrollingDeltas()) ? "true" : "false", ";"));
    sb.append(makeString(" ts=", String::number(m_platformEvent.timestamp()), ";"));
#endif
    sb.append(")");
    return sb.toString();
}

void HandleWheelEvent::dispatch(DeterminismController* controller)
{
    ASSERT(controller->page());
    ASSERT(sealed());

    controller->page()->userInputProxy()->handleWheelEvent(const_cast<PlatformWheelEvent&>(platformEvent()), true);
    controller->didDispatch(this);
}

size_t HandleWheelEvent::memorySize() const
{
    return sizeof(HandleWheelEvent);
}

void HandleWheelEvent::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("positionX", m_platformEvent.position().x());
    serializer->putInt("positionY", m_platformEvent.position().y());
    serializer->putInt("globalPositionX", m_platformEvent.globalPosition().x());
    serializer->putInt("globalPositionY", m_platformEvent.globalPosition().y());
    serializer->putBoolean("shiftKey", m_platformEvent.shiftKey());
    serializer->putBoolean("ctrlKey", m_platformEvent.ctrlKey());
    serializer->putBoolean("altKey", m_platformEvent.altKey());
    serializer->putBoolean("metaKey", m_platformEvent.metaKey());
    serializer->putFloat("deltaX", m_platformEvent.deltaX());
    serializer->putFloat("deltaY", m_platformEvent.deltaY());
    serializer->putFloat("wheelTicksX", m_platformEvent.wheelTicksX());
    serializer->putFloat("wheelTicksY", m_platformEvent.wheelTicksY());
    serializer->putInt("granularity", m_platformEvent.granularity());
    serializer->putBoolean("directionInvertedFromDevice", m_platformEvent.directionInvertedFromDevice());
    serializer->putDouble("timestamp", m_platformEvent.timestamp());
#if PLATFORM(MAC) || PLATFORM(CHROMIUM)
    serializer->putBoolean("hasPreciseScrollingDeltas", m_platformEvent.hasPreciseScrollingDeltas());
#endif
#if PLATFORM(MAC) || (PLATFORM(CHROMIUM) && OS(DARWIN))
    serializer->putInt("phase", m_platformEvent.phase());
    serializer->putInt("momentumPhase", m_platformEvent.momentumPhase());
    serializer->putUnsigned("scrollCount", m_platformEvent.scrollCount());
    serializer->putFloat("unacceleratedScrollingDeltaX", m_platformEvent.unacceleratedScrollingDeltaX());
    serializer->putFloat("unacceleratedScrollingDeltaY", m_platformEvent.unacceleratedScrollingDeltaY());
#endif
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
