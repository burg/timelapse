/*
 *  Copyright (C) 2012, 2013 Brian Burg.
 *  Copyright (C) 2012, 2013 University of Washington. All rights reserved.
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

#include "JSONInputSerializer.h"

#include "FunctorInputIterator.h"
#include "InspectorValues.h"
#include "Logging.h"
#include "ReplayRecording.h"
#include <wtf/RefPtr.h>
#include <wtf/text/WTFString.h>
#include <wtf/replay/InputIterator.h>

namespace WTF {
static const char* queueTypeToString(ReplayInputQueueType queue) {
    switch (queue) {
        case WTF::EventLoopInputQueue:    return "EventLoopInputQueue";
        case WTF::LoaderMemoizedDataQueue:    return "LoaderMemoizedDataQueue";
        case WTF::ScriptMemoizedDataQueue:    return "ScriptMemoizedDataQueue";
        case WTF::ReplayInputQueueTypeLength: return "QueueTypeLength (error)";
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

static size_t calculateMemorySizeForRecording(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    CountMemorySize counter;

    for (int i = 0; i < WTF::ReplayInputQueueTypeLength; i++) {
        ReplayInputQueueType queueType = static_cast<ReplayInputQueueType>(i);
        recording->createFunctorIterator()->forEachInputInQueue(queueType, counter);
    }

    return counter.returnValue();
}

class SerializeInputToJSONFunctor {
public:
    typedef PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > ReturnType;

    SerializeInputToJSONFunctor(JSONInputSerializer* serializer)
    : m_serializer(serializer)
    , m_actions(TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput>::create()) {}
    ~SerializeInputToJSONFunctor() {}

    void operator()(size_t index, const NondeterministicInput* action)
    {
        LOG(DeterministicReplay, "%-25s Writing %5zu: %s\n", "[SerializeAction]", index, action->type());

        m_serializer->pushObject(); // the "data" object
        m_serializer->putInt("id", index);
        if (action->queue() == WTF::EventLoopInputQueue)
            action->serializeDispatchInfo(m_serializer);
        action->serialize(m_serializer);

        RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = TypeBuilder::Recordings::ReplayInput::create()
            .setType(action->type())
            .setData(m_serializer->popObject());

        m_actions->addItem(serializedInput.release());
    }

    ReturnType returnValue() { return m_actions.release(); }

private:
    JSONInputSerializer* m_serializer;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > m_actions;
};

JSONInputSerializer::JSONInputSerializer()
    : m_currentObject(0)
    , m_currentArray(0) {}

JSONInputSerializer::~JSONInputSerializer()
{
}

// insert key-value pair into current object
void JSONInputSerializer::putString(const String& key, const String& value)
{
    ASSERT(m_currentObject);

    m_currentObject->setString(key, value);
}

// insert string as element of current array
void JSONInputSerializer::putString(const String& value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushString(value);
}

void JSONInputSerializer::putUnsigned(const String& key, unsigned value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::putUInt32(const String& key, uint32_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::pushUInt32(uint32_t value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushNumber((double) value);
}

void JSONInputSerializer::putUInt64(const String& key, uint64_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::putInt(const String& key, int value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::pushInt32(int32_t value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushNumber((double) value);
}

void JSONInputSerializer::putInt32(const String& key, int32_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::putInt64(const String& key, int64_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::putBoolean(const String& key, bool value)
{
    ASSERT(m_currentObject);

    m_currentObject->setBoolean(key, value);
}

void JSONInputSerializer::putDouble(const String& key, double value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, value);
}

void JSONInputSerializer::putFloat(const String& key, float value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputSerializer::pushArray()
{
    if (m_currentObject)
        m_stack.append(m_currentObject);
    if (m_currentArray)
        m_stack.append(m_currentArray);

    RefPtr<InspectorArray> array = InspectorArray::create();
    m_currentObject = 0;
    m_currentArray = array;
}

void JSONInputSerializer::pushObject()
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
void JSONInputSerializer::popArrayAsProperty(const String& key)
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
void JSONInputSerializer::popObjectAsProperty(const String& key)
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
void JSONInputSerializer::popArrayAsElement()
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
void JSONInputSerializer::popObjectAsElement()
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

void JSONInputSerializer::storeResourceBytes(int /*id*/, const char* /*data*/, int /*length*/)
{
    // TODO(Issue #265): serialize resource bytes using base64 encoding.
}

PassRefPtr<TypeBuilder::Recordings::ReplayRecordingNew> JSONInputSerializer::serialize(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue> > queues = TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue>::create();

    for (int i = 0; i < WTF::ReplayInputQueueTypeLength; i++) {
        SerializeInputToJSONFunctor collector(this);
        ReplayInputQueueType queueType = static_cast<ReplayInputQueueType>(i);
        PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > queueInputs = recording->createFunctorIterator()->forEachInputInQueue(queueType, collector);

        RefPtr<TypeBuilder::Recordings::ReplayInputQueue> queue = TypeBuilder::Recordings::ReplayInputQueue::create()
            .setType(WTF::queueTypeToString(queueType))
            .setInputs(queueInputs);

        queues->addItem(queue.release());
    }

    RefPtr<TypeBuilder::Recordings::ReplayRecordingNew> recordingObject = TypeBuilder::Recordings::ReplayRecordingNew::create()
        .setUid(recording->uid())
        .setDateCreated(recording->creationTimestamp())
        .setMemorySize(calculateMemorySizeForRecording(recording))
        .setQueues(queues.release());

    return recordingObject;
}

// Only to be used to pop the root object, not nested objects.
PassRefPtr<InspectorObject> JSONInputSerializer::popObject()
{
    ASSERT(m_currentObject);
    ASSERT(m_stack.isEmpty());

    return m_currentObject.release();
}

}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
