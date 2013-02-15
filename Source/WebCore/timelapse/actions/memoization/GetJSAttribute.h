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

#ifndef GetJSAttribute_h
#define GetJSAttribute_h

#if ENABLE(TIMELAPSE)

#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace JSC {

namespace ReplayableTypes {
const char* GetJSAttribute = "GetJSAttribute";
}

enum AttributeType {
    ScreenX,
    ScreenY,
    ScreenLeft,
    ScreenTop
};

template<typename T> class GetJSAttribute : public ReplayableAction {

public:
    GetJSAttribute(AttributeType attribute, T result)
        : ReplayableAction(ReplayableTypes::GetJSAttribute)
        , m_attribute(attribute)
        , m_result(result) {}
    virtual ~GetJSAttribute() {}
    
    AttributeType attributeType() const { return m_attribute; }
    T result() const { return m_result; }
    String resultString() const;
    String attributeName() const;

    // ReplayableAction API
    virtual DeterminismQueueType queue() const OVERRIDE { return WTF::ScriptMemoizedDataQueue; }
    virtual String toString() const OVERRIDE;
    virtual size_t memorySize() const OVERRIDE;
    virtual void serialize(ActionSerializer*) const OVERRIDE;
    
private:
    AttributeType m_attribute;
    T m_result;
};

template<typename T> String GetJSAttribute<T>::resultString() const
{
    switch (m_attribute) {
        case ScreenX:
        case ScreenY:
        case ScreenLeft:
        case ScreenTop:
            return String::number(m_result);
    }
}

template<typename T> String GetJSAttribute<T>::attributeName() const
{
    switch(m_attribute) {
        case ScreenX: return String("window.screenX");
        case ScreenY: return String("window.screenY");
        case ScreenLeft: return String("window.screenLeft");
        case ScreenTop: return String("window.screenTop");
    }
}

template<typename T> String GetJSAttribute<T>::toString() const
{
    return makeString("GetJSAttribute(attribute=", attributeName(), ";result=", resultString(), ")");
}

template<typename T> size_t GetJSAttribute<T>::memorySize() const
{
    return sizeof(GetJSAttribute);
}

template<typename T> void GetJSAttribute<T>::serialize(ActionSerializer* serializer) const
{
    serializer->putString("attribute", attributeName());

    switch (m_attribute) {
        case ScreenX:
        case ScreenY:
        case ScreenLeft:
        case ScreenTop:
            serializer->putInt("result", m_result);
    }
}

} //namespace JSC

#endif // ENABLE(TIMELAPSE)

#endif // GetJSAttribute_h
