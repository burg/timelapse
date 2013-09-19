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

#ifndef JSONEncoderContext_h
#define JSONEncoderContext_h

#if ENABLE(WEB_REPLAY)

#include "EncoderContext.h"
#include "InspectorTypeBuilder.h"
#include <wtf/replay/InputIterator.h>

namespace WebCore {
    class InspectorArray;
    class InspectorObject;
    class InspectorValue;
    class ReplayRecording;

    class JSONCoder {
    public:
        static PassRefPtr<TypeBuilder::Recordings::ReplayRecordingNew> serialize(PassRefPtr<ReplayRecording>);
        static PassRefPtr<TypeBuilder::Recordings::ReplayInput> serializeInput(const NondeterministicInput*, int index=0);
        static PassOwnPtr<EncoderContext> createMap();
        static PassOwnPtr<EncoderContext> createList();
    };

    class JSONEncoderContext : public EncoderContext {
    public:
        virtual PassRefPtr<InspectorValue> encodedValue() const =0;
        virtual PassOwnPtr<EncoderContext> createMap() OVERRIDE
        {
            return JSONCoder::createMap();
        }

        virtual PassOwnPtr<EncoderContext> createList() OVERRIDE
        {
            return JSONCoder::createList();
        }
    };

    class JSONMapEncoder : public JSONEncoderContext {
    public:
        JSONMapEncoder();
        virtual ~JSONMapEncoder();

        virtual void putBoolean(const String&, bool) OVERRIDE;
        virtual void putContext(const String&, const EncoderContext&) OVERRIDE;
        virtual void putDouble(const String&, double) OVERRIDE;
        virtual void putFloat(const String&, float) OVERRIDE;
        virtual void putInt(const String&, int) OVERRIDE;
        virtual void putInt32(const String&, int32_t) OVERRIDE;
        virtual void putInt64(const String&, int64_t) OVERRIDE;
        virtual void putString(const String&, const String&) OVERRIDE;
        virtual void putUInt32(const String&, uint32_t) OVERRIDE;
        virtual void putUInt64(const String&, uint64_t) OVERRIDE;
        virtual void putUnsigned(const String&, unsigned) OVERRIDE;

        virtual void putBytes(const String&, const char* data, int length) OVERRIDE;

        virtual PassRefPtr<InspectorValue> encodedValue() const { return m_object; }
    private:
        RefPtr<InspectorObject> m_object;
    };

    class JSONListEncoder : public JSONEncoderContext {
    public:
        JSONListEncoder();
        virtual ~JSONListEncoder();

        virtual void appendContext(const EncoderContext&) OVERRIDE;
        virtual void appendInt32(int32_t) OVERRIDE;
        virtual void appendString(const String&) OVERRIDE;
        virtual void appendUInt32(uint32_t) OVERRIDE;

        virtual PassRefPtr<InspectorValue> encodedValue() const { return m_array; }
    private:
        RefPtr<InspectorArray> m_array;
    };

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // JSONEncoderContext_h
