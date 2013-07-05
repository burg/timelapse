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

#ifndef HandleWheelEvent_h
#define HandleWheelEvent_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputCoder.h"
#include "PlatformWheelEvent.h"

namespace WebCore {

class ReplayController;

class HandleWheelEvent : public EventLoopInput {

public:
    HandleWheelEvent(const PlatformWheelEvent& event)
        : m_platformEvent(event) {}
    virtual ~HandleWheelEvent() {}

    // EventLoopInput API
    virtual void dispatch(ReplayController*, EventLoopInputDispatcher*) OVERRIDE;

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const OVERRIDE;
    size_t memorySize() const OVERRIDE;

    const PlatformWheelEvent& platformEvent() const { return m_platformEvent; }

private:
    PlatformWheelEvent m_platformEvent;
};

template<> struct InputCoder<PlatformWheelEvent> {
    static void encode(InputEncoder& encoder, const PlatformWheelEvent& input);
    static bool decode(InputDecoder& decoder, OwnPtr<PlatformWheelEvent>& input);
};

template<> struct InputCoder<HandleWheelEvent> {
    static void encode(InputEncoder& encoder, const HandleWheelEvent& input);
    static bool decode(InputDecoder& decoder, OwnPtr<HandleWheelEvent>& input);
};

} //namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // HandleWheelEvent_h
