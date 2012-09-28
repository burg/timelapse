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

#include "InitializeFocus.h"

#include "DeterminismController.h"
#include "UserInputProxy.h"
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

void InitializeFocus::dispatch(DeterminismController* controller)
{
    ASSERT(sealed());
    
    Document* document = SerializedEventTarget::documentFromFrameIndex(controller->page(), m_frameIndex);
    PassRefPtr<Frame> framePtr(document->frame());
    
    // Setting active/focus is idempotent, so set it whether or not it needs to be set.
    controller->page()->userInputProxy()->focusSetActive(m_active, true);
    controller->page()->userInputProxy()->focusSetFocused(m_focus, true);
    controller->page()->focusController()->setFocusedFrame(framePtr);
    controller->didDispatch(this);
}

String InitializeFocus::toString() const
{
    return makeString("InitializeFocus(focus=", (m_focus)?"true":"false",
                      "; active=", (m_active)?"true":"false",
                      "; frameIndex=", String::number(m_frameIndex), ")");
}

void InitializeFocus::serialize(ActionSerializer* serializer) const
{
    serializer->putBoolean("active", m_active);
    serializer->putBoolean("focused", m_focus);
    serializer->putInt("frameIndex", m_frameIndex);
}
 
} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
