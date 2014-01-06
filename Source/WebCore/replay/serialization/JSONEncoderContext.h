/*
 * Copyright (C) 2012 University of Washington. All rights reserved.
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
#include "InspectorWebTypeBuilders.h"
#include <wtf/replay/InputIterator.h>

namespace Inspector {
class InspectorArray;
class InspectorObject;
class InspectorValue;
}

namespace WebCore {

class ReplayRecording;
class CaptureSession;

class JSONCoder {
public:
    static RefPtr<Inspector::TypeBuilder::Replay::CaptureSession> serializeSession(RefPtr<CaptureSession>);
    static PassRefPtr<Inspector::TypeBuilder::Replay::ReplayRecording> serialize(PassRefPtr<ReplayRecording>);
    static PassRefPtr<Inspector::TypeBuilder::Replay::ReplayInput> serializeInput(const NondeterministicInput*, int index = 0);
    static std::unique_ptr<EncoderContext> createMap();
    static std::unique_ptr<EncoderContext> createList();
};

class JSONEncoderContext : public EncoderContext {
public:
    virtual PassRefPtr<Inspector::InspectorValue> encodedValue() const =0;
    virtual std::unique_ptr<EncoderContext> createMap() OVERRIDE
    {
        return JSONCoder::createMap();
    }

    virtual std::unique_ptr<EncoderContext> createList() OVERRIDE
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
    virtual void putULong(const String&, unsigned long) OVERRIDE;

    virtual void putBytes(const String&, const char* data, int length) OVERRIDE;

    virtual PassRefPtr<Inspector::InspectorValue> encodedValue() const { return m_object; }
private:
    RefPtr<Inspector::InspectorObject> m_object;
};

class JSONListEncoder : public JSONEncoderContext {
public:
    JSONListEncoder();
    virtual ~JSONListEncoder();

    virtual void appendContext(const EncoderContext&) OVERRIDE;
    virtual void appendInt32(int32_t) OVERRIDE;
    virtual void appendString(const String&) OVERRIDE;
    virtual void appendUInt32(uint32_t) OVERRIDE;

    virtual PassRefPtr<Inspector::InspectorValue> encodedValue() const { return m_array; }
private:
    RefPtr<Inspector::InspectorArray> m_array;
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // JSONEncoderContext_h
