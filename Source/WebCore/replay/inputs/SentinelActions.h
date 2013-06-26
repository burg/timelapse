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

#ifndef SentinelActions_h
#define SentinelActions_h

#if ENABLE(TIMELAPSE)

#include "EventLoopInput.h"
#include "InputCoder.h"
#include <wtf/text/WTFString.h>

namespace WebCore {

class EventLoopInputDispatcher;
class ReplayController;

class BeginSentinel : public EventLoopInput {

public:
    BeginSentinel()
    : EventLoopInput() {}
    virtual ~BeginSentinel() {};

    // EventLoopInput API
    virtual void dispatch(ReplayController*, EventLoopInputDispatcher* dispatcher) OVERRIDE;
    virtual bool isUserVisible() const OVERRIDE { return false; }

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const OVERRIDE { return String("Begin"); }
    size_t memorySize() const OVERRIDE { return sizeof(BeginSentinel); }
};

template<> struct InputCoder<BeginSentinel> {
    static void encode(InputEncoder& encoder, const BeginSentinel& input);
    static bool decode(InputDecoder& decoder, OwnPtr<BeginSentinel>& input);
};

class EndSentinel : public EventLoopInput {

public:
    EndSentinel()
    : EventLoopInput() {}
    virtual ~EndSentinel() {};

    // EventLoopInput API
    virtual void dispatch(ReplayController*, EventLoopInputDispatcher* dispatcher) OVERRIDE;
    virtual bool isUserVisible() const OVERRIDE { return false; }

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const OVERRIDE { return String("End"); }
    size_t memorySize() const OVERRIDE { return sizeof(EndSentinel); }
};

template<> struct InputCoder<EndSentinel> {
    static void encode(InputEncoder& encoder, const EndSentinel& input);
    static bool decode(InputDecoder& decoder, OwnPtr<EndSentinel>& input);
};

} //namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // SentinelActions_h
