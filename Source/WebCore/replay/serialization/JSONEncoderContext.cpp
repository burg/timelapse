/*
 * Copyright (C) 2012, 2013 University of Washington. All rights reserved.
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
#include "JSONEncoderContext.h"

#if ENABLE(WEB_REPLAY)

#include "AllReplayInputs.h"
#include "CaptureSession.h"
#include "FunctorInputIterator.h"
#include "Logging.h"
#include "ReplayRecording.h"
#include <inspector/InspectorValues.h>
#include <wtf/RefPtr.h>
#include <wtf/replay/InputIterator.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>

static const char* queueTypeToString(NondeterministicInput::QueueType queue)
{
    switch (queue) {
    case NondeterministicInput::EventLoopInputQueue:     return "EventLoopInputQueue";
    case NondeterministicInput::LoaderMemoizedDataQueue: return "LoaderMemoizedDataQueue";
    case NondeterministicInput::ScriptMemoizedDataQueue: return "ScriptMemoizedDataQueue";
    case NondeterministicInput::QueueTypeLength:         return "QueueTypeLength (error)";
    }
}

namespace WebCore {

JSONMapEncoder::JSONMapEncoder()
    : m_object(Inspector::InspectorObject::create())
{
}

JSONMapEncoder::~JSONMapEncoder()
{
}

void JSONMapEncoder::putBoolean(const String& key, bool value)
{
    m_object->setBoolean(key, value);
}

void JSONMapEncoder::putDouble(const String& key, double value)
{
    m_object->setNumber(key, value);
}

void JSONMapEncoder::putFloat(const String& key, float value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putInt(const String& key, int value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putInt32(const String& key, int32_t value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putInt64(const String& key, int64_t value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putString(const String& key, const String& value)
{
    m_object->setString(key, value);
}

void JSONMapEncoder::putUInt32(const String& key, uint32_t value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putUInt64(const String& key, uint64_t value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putUnsigned(const String& key, unsigned value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putULong(const String& key, unsigned long value)
{
    m_object->setNumber(key, (double) value);
}

void JSONMapEncoder::putContext(const String& key, const EncoderContext& context)
{
    RefPtr<Inspector::InspectorValue> encodedObject = static_cast<const JSONEncoderContext&>(context).encodedValue();
    m_object->setValue(key, encodedObject);
}

void JSONMapEncoder::putBytes(const String&, const char*, int)
{
    // FIXME: implement
}

JSONListEncoder::JSONListEncoder()
    : m_array(Inspector::InspectorArray::create())
{
}

JSONListEncoder::~JSONListEncoder()
{
}

void JSONListEncoder::appendContext(const EncoderContext& context)
{
    RefPtr<Inspector::InspectorValue> encodedObject = static_cast<const JSONEncoderContext&>(context).encodedValue();
    m_array->pushValue(encodedObject);
}

void JSONListEncoder::appendInt32(int32_t value)
{
    m_array->pushNumber((double) value);
}

void JSONListEncoder::appendString(const String& value)
{
    m_array->pushString(value);
}

void JSONListEncoder::appendUInt32(uint32_t value)
{
    m_array->pushNumber((double) value);
}

class SerializeInputToJSONFunctor {
public:
    typedef PassRefPtr<Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInput> > ReturnType;

    SerializeInputToJSONFunctor()
        : m_inputs(Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInput>::create()) { }
    ~SerializeInputToJSONFunctor() { }

    void operator()(size_t index, const NondeterministicInput* input)
    {
        LOG(DeterministicReplay, "%-25s Writing %5zu: %s\n", "[SerializeInput]", index, input->type().string().ascii().data());

        RefPtr<Inspector::TypeBuilder::Replay::ReplayInput> serializedInput = JSONCoder::serializeInput(input, index);
        if (!serializedInput)
            return;

        m_inputs->addItem(serializedInput.release());
    }

    ReturnType returnValue() { return m_inputs.release(); }
private:
    RefPtr<Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInput> > m_inputs;
};

RefPtr<Inspector::TypeBuilder::Replay::CaptureSession> JSONCoder::serializeSession(RefPtr<CaptureSession> session)
{
    RefPtr<Inspector::TypeBuilder::Array<int> > recordings = Inspector::TypeBuilder::Array<int>::create();

    for (auto it = session->begin(); it < session->end(); ++it)
        recordings->addItem((*it)->uid());

    RefPtr<Inspector::TypeBuilder::Replay::CaptureSession> sessionObject = Inspector::TypeBuilder::Replay::CaptureSession::create()
        .setSessionId(session->uid())
        .setDateCreated(session->creationTimestamp())
        .setRecordings(recordings.release());

    return sessionObject;
}

PassRefPtr<Inspector::TypeBuilder::Replay::ReplayRecording> JSONCoder::serialize(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RefPtr<Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInputQueue> > queues = Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInputQueue>::create();

    for (int i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        SerializeInputToJSONFunctor collector;
        NondeterministicInput::QueueType queueType = static_cast<NondeterministicInput::QueueType>(i);
        RefPtr<Inspector::TypeBuilder::Array<Inspector::TypeBuilder::Replay::ReplayInput> > queueInputs = recording->createFunctorIterator()->forEachInputInQueue(queueType, collector);

        RefPtr<Inspector::TypeBuilder::Replay::ReplayInputQueue> queue = Inspector::TypeBuilder::Replay::ReplayInputQueue::create()
            .setType(queueTypeToString(queueType))
            .setInputs(queueInputs);

        queues->addItem(queue.release());
    }

    RefPtr<Inspector::TypeBuilder::Replay::ReplayRecording> recordingObject = Inspector::TypeBuilder::Replay::ReplayRecording::create()
        .setRecordingId(recording->uid())
        .setDateCreated(recording->creationTimestamp())
        .setQueues(queues.release());

    return recordingObject;
}

PassRefPtr<Inspector::TypeBuilder::Replay::ReplayInput> JSONCoder::serializeInput(const NondeterministicInput* input, int index)
{
    std::unique_ptr<EncoderContext> encodedInput = JSONCoder::createMap();
    encodedInput->put("id", (uint64_t)index);

    if (input->queue() == NondeterministicInput::EventLoopInputQueue)
        static_cast<const EventLoopInput*>(input)->serializeDispatchInfo(*encodedInput);

    // Abort if we couldn't perform type-specific encoding based on the tag.
    if (!encodedInput->encodeInput(input))
        return 0;

    RefPtr<Inspector::TypeBuilder::Replay::ReplayInput> serializedInput = Inspector::TypeBuilder::Replay::ReplayInput::create()
        .setType(input->type())
        .setData(static_cast<JSONEncoderContext*>(encodedInput.get())->encodedValue()->asObject());

    return serializedInput.release();
}

std::unique_ptr<EncoderContext> JSONCoder::createMap()
{
    return std::make_unique<JSONMapEncoder>();
}

std::unique_ptr<EncoderContext> JSONCoder::createList()
{
    return std::make_unique<JSONListEncoder>();
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
