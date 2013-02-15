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

#ifndef ActionSerializer_h
#define ActionSerializer_h

#include <wtf/Noncopyable.h>
#include <wtf/text/WTFString.h>
#include <wtf/timelapse/ReplayableAction.h>

namespace WTF {

    class ActionSerializer {
        WTF_MAKE_NONCOPYABLE(ActionSerializer);

    public:
        ActionSerializer() {}
        virtual ~ActionSerializer() {}

        // insert key-value pair into current object
        WTF_EXPORT_PRIVATE virtual void putString(const String&, const String&) =0;
        // insert string as element of current array
        WTF_EXPORT_PRIVATE virtual void putString(const String&) =0;
        WTF_EXPORT_PRIVATE virtual void putUnsigned(const String&, unsigned) =0;
        WTF_EXPORT_PRIVATE virtual void putUInt32(const String&, uint32_t) =0;
        WTF_EXPORT_PRIVATE virtual void pushUInt32(uint32_t) =0;
        WTF_EXPORT_PRIVATE virtual void putUInt64(const String&, uint64_t) =0;
        WTF_EXPORT_PRIVATE virtual void putInt(const String&, int) =0;
        WTF_EXPORT_PRIVATE virtual void putInt32(const String&, int32_t) =0;
        WTF_EXPORT_PRIVATE virtual void pushInt32(int32_t) =0;
        WTF_EXPORT_PRIVATE virtual void putInt64(const String&, int64_t) =0;
        WTF_EXPORT_PRIVATE virtual void putBoolean(const String&, bool) =0;
        WTF_EXPORT_PRIVATE virtual void putDouble(const String&, double) =0;
        WTF_EXPORT_PRIVATE virtual void putFloat(const String&, float) =0;
        WTF_EXPORT_PRIVATE virtual void pushArray() =0;
        WTF_EXPORT_PRIVATE virtual void pushObject() =0;
        // pops and stores key-value pair with it as value
        WTF_EXPORT_PRIVATE virtual void popArrayAsProperty(const String&) =0;
        WTF_EXPORT_PRIVATE virtual void popObjectAsProperty(const String&) =0;
        // pops and inserts as element of current array
        WTF_EXPORT_PRIVATE virtual void popArrayAsElement() =0;
        WTF_EXPORT_PRIVATE virtual void popObjectAsElement() =0;
        WTF_EXPORT_PRIVATE virtual void storeResourceBytes(int, const char* bytes, int length) =0;
    };

} // namespace WTF

using WTF::ActionSerializer;

#endif // ActionSerializer_h
