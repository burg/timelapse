/*
 * Copyright (C) 2013, University of Washington. All rights reserved.
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
#include "EncoderContext.h"

#if ENABLE(WEB_REPLAY)

#include "AllReplayInputs.h"
#include "JavaScriptCoreInputCoders.h"
#include "ReplayInputTypes.h"

namespace WebCore {

bool EncoderContext::encodeInput(const NondeterministicInput* input)
{
    const AtomicString& type = input->type();

#define INPUT_SPECIFIC_DISPATCH_CHECK(name) \
    if (type == inputTypes().name) { \
        InputCoder<name>::encode(*this, *(static_cast<const name*>(input))); \
        return true; \
    } \

    REPLAY_INPUT_TYPES_FOR_EACH(INPUT_SPECIFIC_DISPATCH_CHECK)

    // We must hardcode these cases because they aren't macro-friendly.
    // Make sure they match the special cases as defined in ReplayInputTypes.h.
    INPUT_SPECIFIC_DISPATCH_CHECK(GetCurrentTime)
#if PLATFORM(MAC)
    INPUT_SPECIFIC_DISPATCH_CHECK(InterpretedKeyCommands)
#endif
    INPUT_SPECIFIC_DISPATCH_CHECK(SetRandomSeed)

#undef INPUT_SPECIFIC_DISPATCH_CHECK

    if (type == inputTypes().AutoMemoized) {
        static_cast<const AutoMemoizedBase*>(input)->encode(*this);
        return true;
    }

    // FIXME: disambiguate AutoMemoized encode methods based on the serialized ctype.
    // https://github.com/burg/timelapse/issues/277
    return false;
}

void EncoderContext::putBoolean(const String&, bool)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putDouble(const String&, double)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putFloat(const String&, float)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putInt(const String&, int)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putInt32(const String&, int32_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putInt64(const String&, int64_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putString(const String&, const String&)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putUInt32(const String&, uint32_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putUInt64(const String&, uint64_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putUnsigned(const String&, unsigned)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putULong(const String&, unsigned long)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putBytes(const String&, const char*, int)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::putContext(const String&, const EncoderContext&)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::appendInt32(int32_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::appendString(const String&)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::appendUInt32(uint32_t)
{
    ASSERT_NOT_REACHED();
}

void EncoderContext::appendContext(const EncoderContext&)
{
    ASSERT_NOT_REACHED();
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
