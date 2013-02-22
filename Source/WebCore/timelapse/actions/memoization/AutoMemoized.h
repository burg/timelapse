/*
 *  Copyright (C) 2012 Jake Bailey.
 *  Copyright (C) 2012 University of Washington. All rights reserved.
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

#ifndef AutoMemoized_h
#define AutoMemoized_h

#if ENABLE(TIMELAPSE)

#include "ReplayableTypes.h"
#include "SerializedScriptValue.h"
#include <runtime/JSObject.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace JSC {

template<typename T>
class AutoMemoized : public ReplayableAction {

public:
    AutoMemoized(const String& attribute, T result)
        : ReplayableAction(WebCore::ReplayableTypes::AutoMemoized)
        , m_attribute(attribute)
        , m_result(result) {}
    virtual ~AutoMemoized() {}
    
    const String& attributeName() const { return m_attribute; }
    T result() const { return m_result; }
    String resultString() const;

    // ReplayableAction API
    virtual DeterminismQueueType queue() const OVERRIDE { return WTF::ScriptMemoizedDataQueue; }
    virtual String toString() const OVERRIDE;
    virtual size_t memorySize() const OVERRIDE;
    virtual void serialize(ActionSerializer*) const OVERRIDE;
    
private:
    String m_attribute;
    T m_result;
};

typedef int ExceptionCode;

template<typename T>
class AutoMemoizedWithExceptionCode : public AutoMemoized<T> {

public:
    AutoMemoizedWithExceptionCode(const String& attribute, T result, ExceptionCode ec)
        : AutoMemoized<T>(attribute, result)
        , m_exceptionCode(ec) {}
    virtual ~AutoMemoizedWithExceptionCode() {}

    ExceptionCode exceptionCode() const { return m_exceptionCode; }

private:
    ExceptionCode m_exceptionCode;
};

template<typename T> inline String AutoMemoized<T>::toString() const
{
    return makeString("AutoMemoized(attribute=", attributeName(), ";result=", resultString(), ")");
}

template<typename T> inline size_t AutoMemoized<T>::memorySize() const
{
    size_t size = sizeof(AutoMemoized);
    size += m_attribute.impl()->cost();
    return size;
}

template<typename T> inline void AutoMemoized<T>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
}

template<> inline void AutoMemoized<int>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
    serializer->putInt("result", m_result);
}

template<> inline void AutoMemoized<unsigned>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
    serializer->putUInt64("result", (uint64_t) m_result);
}

template<> inline void AutoMemoized<double>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
    serializer->putDouble("result", m_result);
}

template<> inline void AutoMemoized<bool>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
    serializer->putBoolean("result", m_result);
}

template<> inline void AutoMemoized<String>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());
    serializer->putString("result", m_result);
}

template<> inline void AutoMemoized<WebCore::SerializedScriptValue>::serialize(ActionSerializer* serializer) const
{
    const String res = m_result.toString();
    serializer->putString("attribute", attributeName());
    serializer->putString("result", res);
}

template<typename T> inline String AutoMemoized<T>::resultString() const
{
    return m_attribute + ": AutoMemoized not implemented";
}

template<> inline String AutoMemoized<int>::resultString() const
{
    return String::number(m_result);
}

template<> inline String AutoMemoized<unsigned>::resultString() const
{
    return String::number(m_result);
}

template<> inline String AutoMemoized<double>::resultString() const
{
    return String::numberToStringECMAScript(m_result);
}

template<> inline String AutoMemoized<bool>::resultString() const
{
    return m_result ? "true" : "false";
}

template<> inline String AutoMemoized<String>::resultString() const
{
    return String::String(m_result);
}

template<> inline String AutoMemoized<WebCore::SerializedScriptValue>::resultString() const
{
    return String::String(m_result.toString());
}

} //namespace JSC

#endif // ENABLE(TIMELAPSE)

#endif // AutoMemoized_h
