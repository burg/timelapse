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

#include "config.h"

#if ENABLE(TIMELAPSE)

#include "InspectorValues.h"
#include "JSONActionSerializer.h"
#include "Logging.h"
#include <wtf/RefPtr.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>
#include <wtf/timelapse/DeterminismLog.h>

namespace WebCore {

JSONActionSerializer::JSONActionSerializer(PassRefPtr<DeterminismLog> log)
    : m_recording(log)
    , m_currentObject(0)
    , m_currentArray(0) {}


// insert key-value pair into current object
void JSONActionSerializer::putString(const String& key, const String& value)
{
    ASSERT(m_currentObject);

    m_currentObject->setString(key, value);
}

// insert string as element of current array
void JSONActionSerializer::putString(const String& value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushString(value);
}

void JSONActionSerializer::putUnsigned(const String& key, unsigned value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::putUInt32(const String& key, uint32_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::pushUInt32(uint32_t value)
{
    ASSERT(m_currentArray);
    
    m_currentArray->pushNumber((double) value);
}

void JSONActionSerializer::putUInt64(const String& key, uint64_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::putInt(const String& key, int value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::pushInt32(int32_t value)
{
    ASSERT(m_currentArray);
    
    m_currentArray->pushNumber((double) value);
}

void JSONActionSerializer::putInt32(const String& key, int32_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::putInt64(const String& key, int64_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::putBoolean(const String& key, bool value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setBoolean(key, value);
}

void JSONActionSerializer::putDouble(const String& key, double value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, value);
}

void JSONActionSerializer::putFloat(const String& key, float value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONActionSerializer::pushArray()
{
    if (m_currentObject)
        m_stack.append(m_currentObject);
    if (m_currentArray)
        m_stack.append(m_currentArray);

    RefPtr<InspectorArray> array = InspectorArray::create();
    m_currentObject = 0;
    m_currentArray = array;
}

void JSONActionSerializer::pushObject()
{
    if (m_currentObject)
        m_stack.append(m_currentObject);
    if (m_currentArray)
        m_stack.append(m_currentArray);

    RefPtr<InspectorObject> object = InspectorObject::create();
    m_currentObject = object;
    m_currentArray = 0;
}

// pops stores key-value pair with current array as value
void JSONActionSerializer::popArrayAsProperty(const String& key)
{
    ASSERT(m_currentArray);
    ASSERT(!m_stack.isEmpty());

    RefPtr<InspectorValue> popped = m_stack.last();
    ASSERT(popped->asObject());

    RefPtr<InspectorArray> oldArray = m_currentArray;
    m_currentObject = popped->asObject();
    m_currentArray = 0;

    m_currentObject->setArray(key, oldArray);
    m_stack.removeLast();
}

// pops stores key-value pair with current array as value
void JSONActionSerializer::popObjectAsProperty(const String& key)
{
    ASSERT(m_currentObject);
    ASSERT(!m_stack.isEmpty());

    RefPtr<InspectorValue> popped = m_stack.last();
    ASSERT(popped->asObject());

    RefPtr<InspectorObject> oldObject = m_currentObject;
    m_currentObject = popped->asObject();
    m_currentArray = 0;

    m_currentObject->setObject(key, oldObject);
    m_stack.removeLast();
}

// pops inserts as element of current object
void JSONActionSerializer::popArrayAsElement()
{
    ASSERT(m_currentArray);
    ASSERT(!m_stack.isEmpty());

    RefPtr<InspectorValue> popped = m_stack.last();
    ASSERT(popped->asArray());
    
    RefPtr<InspectorArray> oldArray = m_currentArray;
    m_currentArray = popped->asArray();
    m_currentObject = 0;
    
    m_currentArray->pushArray(oldArray);
    m_stack.removeLast();
}

// pops inserts as element of current array
void JSONActionSerializer::popObjectAsElement()
{
    ASSERT(m_currentObject);
    ASSERT(!m_stack.isEmpty());

    RefPtr<InspectorValue> popped = m_stack.last();
    ASSERT(popped->asArray());
    
    RefPtr<InspectorObject> oldObject = m_currentObject;
    m_currentArray = popped->asArray();
    m_currentObject = 0;
    
    m_currentArray->pushObject(oldObject);
    m_stack.removeLast();
}

void JSONActionSerializer::storeResourceBytes(int /*id*/, const char* /*data*/, int /*length*/) 
{
    // TODO
}

bool JSONActionSerializer::serializeToFile(FILE* fh)
{
    pushObject();
    m_recording->serialize(this);

    ASSERT(m_currentObject);
    // hella expensive. woops.
    String jsonStr = m_currentObject->toJSONString();
    fputs(jsonStr.utf8().data(), fh);
    return true;
}
        
}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
