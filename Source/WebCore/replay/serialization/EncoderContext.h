/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#ifndef EncoderContext_h
#define EncoderContext_h

#include "InputCoder.h"
#include <wtf/Noncopyable.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

class EncoderContext {
    WTF_MAKE_NONCOPYABLE(EncoderContext);

public:
    EncoderContext() {}
    virtual ~EncoderContext() {}

    template<typename T> void encode(const T& t)
    {
        InputCoder<T>::encode(*this, t);
    }

    // Templatized interface to encode values succinctly.
    template<typename T> void put(const String&, const T&);
    template<typename T> void append(const T&);

protected:
    // Virtual methods to be overridden by the specific encoder context.
    virtual void putBoolean(const String&, bool);
    virtual void putContext(const String&, const EncoderContext&);
    virtual void putDouble(const String&, double);
    virtual void putFloat(const String&, float);
    virtual void putInt(const String&, int);
    virtual void putInt32(const String&, int32_t);
    virtual void putInt64(const String&, int64_t);
    virtual void putString(const String&, const String&);
    virtual void putUInt32(const String&, uint32_t);
    virtual void putUInt64(const String&, uint64_t);
    virtual void putUnsigned(const String&, unsigned);

    virtual void appendInt32(int32_t);
    virtual void appendString(const String&);
    virtual void appendUInt32(uint32_t);
    virtual void appendContext(const EncoderContext&);

public:
    // These methods don't have templatized shortcuts.
    virtual void putBytes(const String&, const char* data, int length);

    virtual PassOwnPtr<EncoderContext> createMap() =0;
    virtual PassOwnPtr<EncoderContext> createList() =0;
};

// Redirectors to virtual methods.
template<> inline void EncoderContext::put(const String& key, const bool& value) {
    return putBoolean(key, value);
}

template<> inline void EncoderContext::put(const String& key, const EncoderContext& value) {
    return putContext(key, value);
}

template<> inline void EncoderContext::put(const String& key, const double& value) {
    return putDouble(key, value);
}

template<> inline void EncoderContext::put(const String& key, const float& value) {
    return putFloat(key, value);
}

template<> inline void EncoderContext::put(const String& key, const int32_t& value) {
    return putInt32(key, value);
}

template<> inline void EncoderContext::put(const String& key, const int64_t& value) {
    return putInt64(key, value);
}

template<> inline void EncoderContext::put(const String& key, const String& value) {
    return putString(key, value);
}

template<> inline void EncoderContext::put(const String& key, const uint32_t& value) {
    return putUInt32(key, value);
}

template<> inline void EncoderContext::put(const String& key, const uint64_t& value) {
    return putUInt64(key, value);
}

template<> inline void EncoderContext::append(const EncoderContext& value) {
    return appendContext(value);
}

template<> inline void EncoderContext::append(const int32_t& value) {
    return appendInt32(value);
}

template<> inline void EncoderContext::append(const String& value) {
    return appendString(value);
}

template<> inline void EncoderContext::append(const uint32_t& value) {
    return appendUInt32(value);
}

} // namespace WebCore

#endif // EncoderContext_h
