/*
 *  Copyright (C) 2012, Jake Bailey.
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

#include "RanPendingScripts.h"

#include "DispatchEventBase.h"
#include "Document.h"
#include "DecoderContext.h"
#include "EncoderContext.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "ScriptRunner.h"
#include "Timer.h"
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

RanPendingScripts::RanPendingScripts(int frameIndex)
: m_frameIndex(frameIndex) {}

const AtomicString& RanPendingScripts::type() const
{
    return inputTypes().RanPendingScripts;
}

String RanPendingScripts::toString() const
{
    return makeString("RanPendingScripts(", String::number(m_frameIndex), ")");
}

void RanPendingScripts::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    ASSERT(sealed());
    Document* document = SerializedEventTarget::documentFromFrameIndex(controller.page(), m_frameIndex);

    //call ScriptRunner timer callback manually
    ScriptRunner* scriptRunner = document->scriptRunner();
    ASSERT(scriptRunner->hasPendingScripts());
    scriptRunner->timerFired(&scriptRunner->m_timer);

    dispatcher.didDispatch(this);
}

void InputCoder<RanPendingScripts>::encode(EncoderContext& encoder, const RanPendingScripts& input)
{
    encoder.put("frameIndex", input.frameIndex());
}

bool InputCoder<RanPendingScripts>::decode(DecoderContext& decoder, OwnPtr<RanPendingScripts>& input)
{
    int frameIndex;
    if (!decoder.get("frameIndex", frameIndex))
        return false;

    input = adoptPtr(new RanPendingScripts(frameIndex));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
