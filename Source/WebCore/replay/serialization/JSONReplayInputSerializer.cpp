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
#include "JSONReplayInputSerializer.h"
#include "Logging.h"
#include <wtf/RefPtr.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>
#include <wtf/replay/ReplayInputLog.h>

namespace WTF {
static const char* queueTypeToString(ReplayInputQueueType queue) {
    switch (queue) {
        case EventLoopInputQueue:    return "EventLoopInputQueue";
        case LoaderMemoizedDataQueue:    return "LoaderMemoizedDataQueue";
        case ScriptMemoizedDataQueue:    return "ScriptMemoizedDataQueue";
        case ReplayInputQueueTypeLength: return "QueueTypeLength (error)";
    }
}
} // namespace WTF

namespace WebCore {

class CountFunctor {
public:
    typedef size_t ReturnType;

    CountFunctor() : m_count(0) { }
    void count(size_t count) { m_count += count; }
    ReturnType returnValue() { return m_count; }

private:
    ReturnType m_count;
};

struct CountMemorySize : CountFunctor {
    void operator()(size_t, const NondeterministicInput* action) {
        count(action->memorySize());
    }
};

class SerializeActionFunctor {
public:
    typedef void ReturnType;

    SerializeActionFunctor(ReplayInputSerializer* serializer)
    : m_serializer(serializer) {}
    ~SerializeActionFunctor() {}

    void operator()(size_t index, const NondeterministicInput* action)
    {
        LOG(DeterministicReplay, "%-25s Writing %5zu: %s\n", "[SerializeAction]",
                                index, action->type());
        m_serializer->pushObject(); // a single action object
        m_serializer->pushObject(); // action object's metadata
        m_serializer->putString("type", action->type());
        m_serializer->putInt("number", index);
        if (action->queue() == WTF::EventLoopInputQueue)
            action->serializeDispatchInfo(m_serializer);
        m_serializer->popObjectAsProperty("metadata");

        m_serializer->pushObject(); // action object's main data
        action->serialize(m_serializer);
        m_serializer->popObjectAsProperty("action");

        m_serializer->popObjectAsElement(); // a single action object    
    }
    ReturnType returnValue() { return void(); }

private:
    ReplayInputSerializer* m_serializer;
};

JSONReplayInputSerializer::JSONReplayInputSerializer(ReplayInputLog* log)
    : m_recording(log)
    , m_currentObject(0)
    , m_currentArray(0) {}

// insert key-value pair into current object
void JSONReplayInputSerializer::putString(const String& key, const String& value)
{
    ASSERT(m_currentObject);

    m_currentObject->setString(key, value);
}

// insert string as element of current array
void JSONReplayInputSerializer::putString(const String& value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushString(value);
}

void JSONReplayInputSerializer::putUnsigned(const String& key, unsigned value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::putUInt32(const String& key, uint32_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::pushUInt32(uint32_t value)
{
    ASSERT(m_currentArray);
    
    m_currentArray->pushNumber((double) value);
}

void JSONReplayInputSerializer::putUInt64(const String& key, uint64_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::putInt(const String& key, int value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::pushInt32(int32_t value)
{
    ASSERT(m_currentArray);
    
    m_currentArray->pushNumber((double) value);
}

void JSONReplayInputSerializer::putInt32(const String& key, int32_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::putInt64(const String& key, int64_t value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::putBoolean(const String& key, bool value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setBoolean(key, value);
}

void JSONReplayInputSerializer::putDouble(const String& key, double value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, value);
}

void JSONReplayInputSerializer::putFloat(const String& key, float value)
{
    ASSERT(m_currentObject);
    
    m_currentObject->setNumber(key, (double) value);
}

void JSONReplayInputSerializer::pushArray()
{
    if (m_currentObject)
        m_stack.append(m_currentObject);
    if (m_currentArray)
        m_stack.append(m_currentArray);

    RefPtr<InspectorArray> array = InspectorArray::create();
    m_currentObject = 0;
    m_currentArray = array;
}

void JSONReplayInputSerializer::pushObject()
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
void JSONReplayInputSerializer::popArrayAsProperty(const String& key)
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
void JSONReplayInputSerializer::popObjectAsProperty(const String& key)
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
void JSONReplayInputSerializer::popArrayAsElement()
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
void JSONReplayInputSerializer::popObjectAsElement()
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

void JSONReplayInputSerializer::storeResourceBytes(int /*id*/, const char* /*data*/, int /*length*/) 
{
    // TODO
}

size_t JSONReplayInputSerializer::memorySize()
{
    CountMemorySize counter;
    
    for (int i = 0; i < WTF::ReplayInputQueueTypeLength; i++) {
        ReplayInputQueueType queueType = static_cast<ReplayInputQueueType>(i);
        m_recording->forEachInputInQueue(queueType, counter);
    }

    return counter.returnValue();
}

bool JSONReplayInputSerializer::serializeToFile(FILE* fh)
{
    pushObject();
    
    /* the overall recording has the form:
    {
      metadata: {
                  memorySize: ...,
                  ...
      },
      queues: [ { 'name': 'foo', actions: [ { ... }, { ... }, ... ] } ]
    }*/
    
    pushObject(); // the entire recording object
    // TODO: add other recording metadata?
    putInt("memorySize", memorySize());
    popObjectAsProperty("metadata");
    
    pushArray(); // array of queues
    
    /* each action has the form:
    {
      metadata: { 
                 "type":   ...,
                 "number": ...,
                ...
      },
      action: { 
                "foo": ...,
                ...
      }
    }*/

    SerializeActionFunctor collector(this);
    
    for (int i = 0; i < WTF::ReplayInputQueueTypeLength; i++) {
        ReplayInputQueueType queueType = static_cast<ReplayInputQueueType>(i);
        pushObject(); // a single queue object
    
        putString("name", WTF::queueTypeToString(queueType));
        pushArray(); // array of action objects

        m_recording->forEachInputInQueue(queueType, collector);
        
        popArrayAsProperty("actions");
        popObjectAsElement();
    }
    popArrayAsProperty("queues");

    ASSERT(m_currentObject);
    // hella expensive. woops.
    String jsonStr = m_currentObject->toJSONString();
    fputs(jsonStr.utf8().data(), fh);
    return true;
}
        
}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
