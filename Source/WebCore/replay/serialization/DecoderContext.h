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

#ifndef DecoderContext_h
#define DecoderContext_h

#include "InputCoder.h"
#include <wtf/Noncopyable.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

class DecoderContext {
    WTF_MAKE_NONCOPYABLE(DecoderContext);

public:
    DecoderContext() {}
    virtual ~DecoderContext() {}

    template<typename T> void decode(const T& t)
    {
        InputCoder<T>::decode(*this, t);
    }

    // Templatized interface to decode values succinctly.
    template<typename T> bool get(const String&, T&);
    template<typename T> bool pop(T&);

protected:
    // Virtual methods are overridden by the specific encoder context.
    virtual bool getString(const String&, String&) =0;
    virtual bool getBoolean(const String&, bool&) =0;

    virtual bool getDouble(const String&, double&) =0;
    virtual bool getFloat(const String&, float&) =0;

    virtual bool getInt32(const String&, int32_t&) =0;
    virtual bool getInt64(const String&, int64_t&) =0;
    virtual bool getUInt32(const String&, uint32_t&) =0;
    virtual bool getUInt64(const String&, uint64_t&) =0;
};


// Redirectors to virtual methods.
template<> inline bool DecoderContext::get(const String& key, String& result) {
    return getString(key, result);
}

template<> inline bool DecoderContext::get(const String& key, bool& result) {
    return getBoolean(key, result);
}

template<> inline bool DecoderContext::get(const String& key, double& result) {
    return getDouble(key, result);
}

template<> inline bool DecoderContext::get(const String& key, float& result) {
    return getFloat(key, result);
}

template<> inline bool DecoderContext::get(const String& key, int32_t& result) {
    return getInt32(key, result);
}

template<> inline bool DecoderContext::get(const String& key, int64_t& result) {
    return getInt64(key, result);
}

template<> inline bool DecoderContext::get(const String& key, uint32_t& result) {
    return getUInt32(key, result);
}

template<> inline bool DecoderContext::get(const String& key, uint64_t& result) {
    return getUInt64(key, result);
}

} // namespace WebCore

#endif // DecoderContext_h
