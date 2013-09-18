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

#include "FocusSetActive.h"

#include "DecoderContext.h"
#include "EncoderContext.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "Page.h"
#include "UserInputProxy.h"
#include <wtf/Assertions.h>

namespace WebCore {

const AtomicString& FocusSetActive::type() const
{
    return inputTypes().FocusSetActive;
}

String FocusSetActive::toString() const
{
    if (m_toState)
        return "FocusSetActive(to=active)";
    else
        return "FocusSetActive(to=inactive)";
}

void FocusSetActive::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    ASSERT(controller.page());
    ASSERT(sealed());

    controller.page()->userInputProxy().focusSetActive(m_toState, true);
    dispatcher.didDispatch(this);
}

void InputCoder<FocusSetActive>::encode(EncoderContext& encoder, const FocusSetActive& input)
{
    encoder.put("toState", input.toState());
}

bool InputCoder<FocusSetActive>::decode(DecoderContext& decoder, OwnPtr<FocusSetActive>& input)
{
    bool toState;
    if (!decoder.get("toState", toState))
        return false;

    input = adoptPtr(new FocusSetActive(toState));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
