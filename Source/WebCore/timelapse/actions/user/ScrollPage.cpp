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

#include "ScrollPage.h"

#include "DeterminismController.h"
#include "Page.h"
#include "ReplayableTypes.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

//TODO: move to ScrollTypes.h?
String ScrollPage::scrollDirectionToString(ScrollDirection direction) 
{
    switch (direction) {
    case ScrollUp:     return "Up";
    case ScrollDown:   return "Down";
    case ScrollLeft:   return "Left";
    case ScrollRight:  return "Right";
    default: 
        ASSERT_NOT_REACHED(); 
        return String();
    }
}

String ScrollPage::logicalScrollDirectionToString(ScrollLogicalDirection direction) 
{
    switch (direction) {
    case ScrollBlockDirectionBackward:  return "BlockBackward";
    case ScrollBlockDirectionForward:   return "BlockForward";
    case ScrollInlineDirectionBackward: return "InlineBackward";
    case ScrollInlineDirectionForward:  return "InlineForward";
    default: 
        ASSERT_NOT_REACHED(); 
        return String();
    }
}

String ScrollPage::scrollGranularityToString(ScrollGranularity granularity)
{
    switch (granularity) {
    case ScrollByLine:     return "Line";
    case ScrollByPage:     return "Page";
    case ScrollByDocument: return "Document";
    case ScrollByPixel:    return "Pixel";
    default: 
        ASSERT_NOT_REACHED(); 
        return String();
    }
}

String ScrollPage::toString() const
{
    StringBuilder sb;
    sb.append("ScrollPage(");
    sb.append(makeString("type=", (isLogicalScroll()) ? "logical" : "normal", "; "));
    if (isLogicalScroll())
        sb.append(makeString("direction=", logicalScrollDirectionToString(logicalScrollDirection()), "; "));
    else
        sb.append(makeString("direction=", scrollDirectionToString(scrollDirection()), "; "));
    sb.append(makeString("granularity=", scrollGranularityToString(scrollGranularity()), ";"));
    sb.append(")");
    return sb.toString();
}

void ScrollPage::serialize(ActionSerializer* serializer) const
{
    if (m_isLogicalScroll)
        serializer->putInt("scrollDirection", m_direction.normal);
    else
        serializer->putInt("scrollLogicalDirection", m_direction.logical);
    serializer->putInt("granularity", m_granularity);
}

void ScrollPage::dispatch(DeterminismController* controller)
{
    ASSERT(controller->page());
    ASSERT(sealed());
    
    if (isLogicalScroll())
        controller->page()->userInputProxy()->scrollRecursivelyLogical(logicalScrollDirection(), scrollGranularity(), true);
    else
        controller->page()->userInputProxy()->scrollRecursively(scrollDirection(), scrollGranularity(), true);

    controller->didDispatch(this);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
