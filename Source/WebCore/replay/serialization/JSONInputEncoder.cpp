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

#include "JSONInputEncoder.h"

#include "FunctorInputIterator.h"
#include "InspectorValues.h"
#include "Logging.h"
#include "ReplayInputTypes.h"
#include "ReplayRecording.h"
#include <wtf/RefPtr.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>
#include <wtf/replay/InputIterator.h>

#include "DisableCache.h"
#include "DispatchFakeMouseMove.h"
#include "EnableCache.h"
#include "FocusSetActive.h"
#include "FocusSetFocused.h"
#include "HandleContextMenu.h"
#include "HandleKeyPress.h"
#include "HandleMousePress.h"
#include "HandleMouseMove.h"
#include "HandleMouseRelease.h"
#include "HandleWheelEvent.h"
#include "InitializeFocus.h"
#include "InitializeWindow.h"
#include "InterpretedKeyCommands.h"
#include "JavaScriptCoreInputCoders.h"
#include "NavigateToPage.h"
#include "PlaybackError.h"
#include "RanPendingScripts.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "SentinelActions.h"
#include "TimerCreated.h"
#include "TimerFired.h"

static const char* queueTypeToString(NondeterministicInput::QueueType queue) {
    switch (queue) {
        case NondeterministicInput::EventLoopInputQueue:     return "EventLoopInputQueue";
        case NondeterministicInput::LoaderMemoizedDataQueue: return "LoaderMemoizedDataQueue";
        case NondeterministicInput::ScriptMemoizedDataQueue: return "ScriptMemoizedDataQueue";
        case NondeterministicInput::QueueTypeLength:         return "QueueTypeLength (error)";
    }
}

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
    void operator()(size_t, const NondeterministicInput* input) {
        count(input->memorySize());
    }
};

static size_t calculateMemorySizeForRecording(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    CountMemorySize counter;

    for (int i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        NondeterministicInput::QueueType queueType = static_cast<NondeterministicInput::QueueType>(i);
        recording->createFunctorIterator()->forEachInputInQueue(queueType, counter);
    }

    return counter.returnValue();
}

static bool dispatchTypeSpecificEncodeMethod(JSONInputEncoder& encoder, const NondeterministicInput* input)
{
    DEFINE_STATIC_LOCAL(const AtomicString, getCurrentTimeType, ("GetCurrentTime", AtomicString::ConstructFromLiteral));
    DEFINE_STATIC_LOCAL(const AtomicString, setRandomSeedType, ("SetRandomSeed", AtomicString::ConstructFromLiteral));

    const AtomicString& type = input->type();

    if (type == inputTypes().BeginSentinel) {
        InputCoder<BeginSentinel>::encode(encoder, *(static_cast<const BeginSentinel*>(input)));
        return true;
    }
    if (type == inputTypes().DisableCache) {
        InputCoder<DisableCache>::encode(encoder, *(static_cast<const DisableCache*>(input)));
        return true;
    }
    if (type == inputTypes().DispatchFakeMouseMove) {
        InputCoder<DispatchFakeMouseMove>::encode(encoder, *(static_cast<const DispatchFakeMouseMove*>(input)));
        return true;
    }
    if (type == inputTypes().EnableCache) {
        InputCoder<EnableCache>::encode(encoder, *(static_cast<const EnableCache*>(input)));
        return true;
    }
    if (type == inputTypes().EndSentinel) {
        InputCoder<EndSentinel>::encode(encoder, *(static_cast<const EndSentinel*>(input)));
        return true;
    }
    if (type == inputTypes().FocusSetActive) {
        InputCoder<FocusSetActive>::encode(encoder, *(static_cast<const FocusSetActive*>(input)));
        return true;
    }
    if (type == inputTypes().FocusSetFocused) {
        InputCoder<FocusSetFocused>::encode(encoder, *(static_cast<const FocusSetFocused*>(input)));
        return true;
    }
    if (type == getCurrentTimeType) {
        InputCoder<JSC::GetCurrentTime>::encode(encoder, *(static_cast<const JSC::GetCurrentTime*>(input)));
        return true;
    }
    if (type == inputTypes().HandleContextMenu) {
        InputCoder<HandleContextMenu>::encode(encoder, *(static_cast<const HandleContextMenu*>(input)));
        return true;
    }
    if (type == inputTypes().HandleKeyPress) {
        InputCoder<HandleKeyPress>::encode(encoder, *(static_cast<const HandleKeyPress*>(input)));
        return true;
    }
    if (type == inputTypes().HandleMousePress) {
        InputCoder<HandleMousePress>::encode(encoder, *(static_cast<const HandleMousePress*>(input)));
        return true;
    }
    if (type == inputTypes().HandleMouseMove) {
        InputCoder<HandleMouseMove>::encode(encoder, *(static_cast<const HandleMouseMove*>(input)));
        return true;
    }
    if (type == inputTypes().HandleMouseRelease) {
        InputCoder<HandleMouseRelease>::encode(encoder, *(static_cast<const HandleMouseRelease*>(input)));
        return true;
    }
    if (type == inputTypes().HandleWheelEvent) {
        InputCoder<HandleWheelEvent>::encode(encoder, *(static_cast<const HandleWheelEvent*>(input)));
        return true;
    }
    if (type == inputTypes().InitializeFocus) {
        InputCoder<InitializeFocus>::encode(encoder, *(static_cast<const InitializeFocus*>(input)));
        return true;
    }
    if (type == inputTypes().InitializeWindow) {
        InputCoder<InitializeWindow>::encode(encoder, *(static_cast<const InitializeWindow*>(input)));
        return true;
    }
#if PLATFORM(MAC)
    if (type == inputTypes().InterpretedKeyCommands) {
        InputCoder<InterpretedKeyCommands>::encode(encoder, *(static_cast<const InterpretedKeyCommands*>(input)));
        return true;
    }
#endif // PLATFORM(MAC)
    if (type == inputTypes().NavigateToPage) {
        InputCoder<NavigateToPage>::encode(encoder, *(static_cast<const NavigateToPage*>(input)));
        return true;
    }
    if (type == inputTypes().PlaybackError) {
        InputCoder<PlaybackError>::encode(encoder, *(static_cast<const PlaybackError*>(input)));
        return true;
    }
    if (type == inputTypes().RanPendingScripts) {
        InputCoder<RanPendingScripts>::encode(encoder, *(static_cast<const RanPendingScripts*>(input)));
        return true;
    }
    if (type == inputTypes().ScrollPage) {
        InputCoder<ScrollPage>::encode(encoder, *(static_cast<const ScrollPage*>(input)));
        return true;
    }
    if (type == inputTypes().SendResizeEvent) {
        InputCoder<SendResizeEvent>::encode(encoder, *(static_cast<const SendResizeEvent*>(input)));
        return true;
    }
    if (type == setRandomSeedType) {
        InputCoder<JSC::SetRandomSeed>::encode(encoder, *(static_cast<const JSC::SetRandomSeed*>(input)));
        return true;
    }
    if (type == inputTypes().TimerCreated) {
        InputCoder<TimerCreated>::encode(encoder, *(static_cast<const TimerCreated*>(input)));
        return true;
    }
    if (type == inputTypes().TimerFired) {
        InputCoder<TimerFired>::encode(encoder, *(static_cast<const TimerFired*>(input)));
        return true;
    }

    return false;
}

class SerializeInputToJSONFunctor {
public:
    typedef PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > ReturnType;

    SerializeInputToJSONFunctor(JSONInputEncoder* encoder)
    : m_encoder(encoder)
    , m_inputs(TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput>::create()) {}
    ~SerializeInputToJSONFunctor() {}

    void operator()(size_t index, const NondeterministicInput* input)
    {
        LOG(DeterministicReplay, "%-25s Writing %5zu: %s\n", "[SerializeInput]", index, input->type().string().ascii().data());

        RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = m_encoder->serializeInput(input, index);
        if (!serializedInput)
            return;
        
        m_inputs->addItem(serializedInput.release());
    }

    ReturnType returnValue() { return m_inputs.release(); }
private:
    JSONInputEncoder* m_encoder;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > m_inputs;
};

JSONInputEncoder::JSONInputEncoder()
    : m_currentObject(0)
    , m_currentArray(0) {}

JSONInputEncoder::~JSONInputEncoder()
{
}

void JSONInputEncoder::putBoolean(const String& key, bool value)
{
    ASSERT(m_currentObject);

    m_currentObject->setBoolean(key, value);
}

void JSONInputEncoder::putDouble(const String& key, double value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, value);
}

void JSONInputEncoder::putFloat(const String& key, float value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putInt(const String& key, int value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putInt32(const String& key, int32_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putInt64(const String& key, int64_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putString(const String& key, const String& value)
{
    ASSERT(m_currentObject);

    m_currentObject->setString(key, value);
}

void JSONInputEncoder::putUInt32(const String& key, uint32_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putUInt64(const String& key, uint64_t value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

void JSONInputEncoder::putUnsigned(const String& key, unsigned value)
{
    ASSERT(m_currentObject);

    m_currentObject->setNumber(key, (double) value);
}

// insert string as element of current array
void JSONInputEncoder::appendString(const String& value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushString(value);
}

void JSONInputEncoder::appendInt32(int32_t value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushNumber((double) value);
}

void JSONInputEncoder::appendUInt32(uint32_t value)
{
    ASSERT(m_currentArray);

    m_currentArray->pushNumber((double) value);
}

void JSONInputEncoder::pushArray()
{
    if (m_currentObject)
        m_stack.append(m_currentObject);
    if (m_currentArray)
        m_stack.append(m_currentArray);

    RefPtr<InspectorArray> array = InspectorArray::create();
    m_currentObject = 0;
    m_currentArray = array;
}

void JSONInputEncoder::pushObject()
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
void JSONInputEncoder::popArrayAsProperty(const String& key)
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
void JSONInputEncoder::popObjectAsProperty(const String& key)
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
void JSONInputEncoder::popArrayAsElement()
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
void JSONInputEncoder::popObjectAsElement()
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

void JSONInputEncoder::storeResourceBytes(int /*id*/, const char* /*data*/, int /*length*/)
{
    // TODO(Issue #265): serialize resource bytes using base64 encoding.
}

// Only to be used to pop the root object, not nested objects.
PassRefPtr<InspectorObject> JSONInputEncoder::popObject()
{
    ASSERT(m_currentObject);
    ASSERT(m_stack.isEmpty());

    return m_currentObject.release();
}

PassRefPtr<TypeBuilder::Recordings::ReplayRecordingNew> JSONInputEncoder::serialize(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue> > queues = TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue>::create();

    for (int i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        SerializeInputToJSONFunctor collector(this);
        NondeterministicInput::QueueType queueType = static_cast<NondeterministicInput::QueueType>(i);
        PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > queueInputs = recording->createFunctorIterator()->forEachInputInQueue(queueType, collector);

        RefPtr<TypeBuilder::Recordings::ReplayInputQueue> queue = TypeBuilder::Recordings::ReplayInputQueue::create()
            .setType(queueTypeToString(queueType))
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

PassRefPtr<TypeBuilder::Recordings::ReplayInput> JSONInputEncoder::serializeInput(const NondeterministicInput* input, int index)
{
    pushObject(); // the "data" object
    put("id", (uint64_t)index);

    // TODO: remove
    if (input->queue() == NondeterministicInput::EventLoopInputQueue)
        static_cast<const EventLoopInput*>(input)->serializeDispatchInfo(*this);

    // abort if we couldn't perform type-specific encoding based on the tag.
    if (!dispatchTypeSpecificEncodeMethod(*this, input)) {
        popObject();
        return 0;
    }

    RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = TypeBuilder::Recordings::ReplayInput::create()
                .setType(input->type())
                .setData(popObject());

    return serializedInput.release();
}

}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
