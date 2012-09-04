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

#ifndef JSONActionSerializer_h
#define JSONActionSerializer_h

#if ENABLE(TIMELAPSE)

#include "InspectorValues.h"
#include <stdio.h>
#include <wtf/Noncopyable.h>
#include <wtf/timelapse/ActionSerializer.h>
#include <wtf/timelapse/DeterminismLog.h>

namespace WebCore {

    class JSONActionSerializer : public ActionSerializer {
        WTF_MAKE_NONCOPYABLE(JSONActionSerializer);
    public:
        JSONActionSerializer(PassRefPtr<DeterminismLog>);
        virtual ~JSONActionSerializer() {};

        // insert key-value pair into current object
        virtual void putString(const String&, const String&) OVERRIDE;
        // insert string as element of current array
        virtual void putString(const String&) OVERRIDE;
        virtual void putUnsigned(const String&, unsigned) OVERRIDE;
        virtual void pushUInt32(uint32_t) OVERRIDE;
        virtual void putUInt32(const String&, uint32_t) OVERRIDE;
        virtual void putUInt64(const String&, uint64_t) OVERRIDE;
        virtual void putInt(const String&, int) OVERRIDE;
        virtual void pushInt32(int32_t) OVERRIDE;
        virtual void putInt32(const String&, int32_t) OVERRIDE;
        virtual void putInt64(const String&, int64_t) OVERRIDE;
        virtual void putBoolean(const String&, bool) OVERRIDE;
        virtual void putDouble(const String&, double) OVERRIDE;
        virtual void putFloat(const String&, float) OVERRIDE;
        virtual void pushArray() OVERRIDE;
        virtual void pushObject() OVERRIDE;
        // pops and stores key-value pair with it as value
        virtual void popArrayAsProperty(const String&) OVERRIDE;
        virtual void popObjectAsProperty(const String&) OVERRIDE;
        // pops and inserts as element of current array
        virtual void popArrayAsElement() OVERRIDE;
        virtual void popObjectAsElement() OVERRIDE;
        virtual void storeResourceBytes(int, const char* data, int length) OVERRIDE;

        bool serializeToFile(FILE*);
    private:
        RefPtr<DeterminismLog> m_recording;
        RefPtr<InspectorObject> m_currentObject;
        RefPtr<InspectorArray> m_currentArray;
        Vector<RefPtr<InspectorValue> > m_stack;
    };

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // JSONActionSerializer_h
