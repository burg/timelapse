/*
 * Copyright (C) 2011 University of Washington. All rights reserved.
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

#ifndef DOMTimerFired_h
#define DOMTimerFired_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputCoder.h"

namespace WebCore {

class ReplayController;

class DOMTimerFired : public EventLoopInput {
public:
    DOMTimerFired(int timerId, int frameIndex);
    virtual ~DOMTimerFired() { }

    int timerId() const { return m_timerId; }
    int frameIndex() const { return m_frameIndex; }

    // EventLoopInput API
    virtual void dispatch(ReplayController&);

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const;
private:
    int m_timerId;
    int m_frameIndex;
};

template<> struct InputCoder<DOMTimerFired> {
    static void encode(EncoderContext&, const DOMTimerFired& input);
    static bool decode(DecoderContext&, std::unique_ptr<DOMTimerFired>& input);
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // DOMTimerFired_h
