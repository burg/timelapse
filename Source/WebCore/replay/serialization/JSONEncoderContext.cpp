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

#if ENABLE(WEB_REPLAY)

#include "JSONEncoderContext.h"

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
#include "ResourceCannotShowURL.h"
#include "ResourceDidFail.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceDidSendData.h"
#include "ResourceLoaderCreated.h"
#include "ResourceLoaderDestroyed.h"
#include "ResourceWasBlocked.h"
#include "ResourceWillSendRequest.h"
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

static bool dispatchTypeSpecificEncodeMethod(EncoderContext& encoder, const NondeterministicInput* input)
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
    if (type == inputTypes().ResourceCannotShowURL) {
        InputCoder<ResourceCannotShowURL>::encode(encoder, *(static_cast<const ResourceCannotShowURL*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceDidFail) {
        InputCoder<ResourceDidFail>::encode(encoder, *(static_cast<const ResourceDidFail*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceDidFinishLoading) {
        InputCoder<ResourceDidFinishLoading>::encode(encoder, *(static_cast<const ResourceDidFinishLoading*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceDidReceiveData) {
        InputCoder<ResourceDidReceiveData>::encode(encoder, *(static_cast<const ResourceDidReceiveData*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceDidReceiveResponse) {
        InputCoder<ResourceDidReceiveResponse>::encode(encoder, *(static_cast<const ResourceDidReceiveResponse*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceDidSendData) {
        InputCoder<ResourceDidSendData>::encode(encoder, *(static_cast<const ResourceDidSendData*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceLoaderCreated) {
        InputCoder<ResourceLoaderCreated>::encode(encoder, *(static_cast<const ResourceLoaderCreated*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceLoaderDestroyed) {
        InputCoder<ResourceLoaderDestroyed>::encode(encoder, *(static_cast<const ResourceLoaderDestroyed*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceWasBlocked) {
        InputCoder<ResourceWasBlocked>::encode(encoder, *(static_cast<const ResourceWasBlocked*>(input)));
        return true;
    }
    if (type == inputTypes().ResourceWillSendRequest) {
        InputCoder<ResourceWillSendRequest>::encode(encoder, *(static_cast<const ResourceWillSendRequest*>(input)));
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

JSONMapEncoder::JSONMapEncoder()
: m_object(InspectorObject::create()) {}

JSONMapEncoder::~JSONMapEncoder() {}

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

void JSONMapEncoder::putContext(const String& key, const EncoderContext& context)
{
    RefPtr<InspectorValue> encodedObject = static_cast<const JSONEncoderContext&>(context).encodedValue();
    m_object->setValue(key, encodedObject);
}

void JSONMapEncoder::putBytes(const String& key, const char* data, int length)
{
    // TODO: implement
    UNUSED_PARAM(key);
    UNUSED_PARAM(data);
    UNUSED_PARAM(length);
}

JSONListEncoder::JSONListEncoder()
: m_array(InspectorArray::create()) {}

JSONListEncoder::~JSONListEncoder() {}

void JSONListEncoder::appendContext(const EncoderContext& context)
{
    RefPtr<InspectorValue> encodedObject = static_cast<const JSONEncoderContext&>(context).encodedValue();
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
    typedef PassRefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > ReturnType;

    SerializeInputToJSONFunctor()
    : m_inputs(TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput>::create()) {}
    ~SerializeInputToJSONFunctor() {}

    void operator()(size_t index, const NondeterministicInput* input)
    {
        LOG(DeterministicReplay, "%-25s Writing %5zu: %s\n", "[SerializeInput]", index, input->type().string().ascii().data());

        RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = JSONCoder::serializeInput(input, index);
        if (!serializedInput)
            return;

        m_inputs->addItem(serializedInput.release());
    }

    ReturnType returnValue() { return m_inputs.release(); }
private:
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInput> > m_inputs;
};

PassRefPtr<TypeBuilder::Recordings::ReplayRecordingNew> JSONCoder::serialize(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RefPtr<TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue> > queues = TypeBuilder::Array<TypeBuilder::Recordings::ReplayInputQueue>::create();

    for (int i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        SerializeInputToJSONFunctor collector;
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
        .setMemorySize(recording->memorySize())
        .setQueues(queues.release());

    return recordingObject;
}

PassRefPtr<TypeBuilder::Recordings::ReplayInput> JSONCoder::serializeInput(const NondeterministicInput* input, int index)
{
    OwnPtr<EncoderContext> encodedInput = JSONCoder::createMap();
    encodedInput->put("id", (uint64_t)index);

    // TODO: remove
    if (input->queue() == NondeterministicInput::EventLoopInputQueue)
        static_cast<const EventLoopInput*>(input)->serializeDispatchInfo(*encodedInput);

    // abort if we couldn't perform type-specific encoding based on the tag.
    if (!dispatchTypeSpecificEncodeMethod(*encodedInput, input))
        return 0;

    RefPtr<TypeBuilder::Recordings::ReplayInput> serializedInput = TypeBuilder::Recordings::ReplayInput::create()
                .setType(input->type())
                .setData(static_cast<JSONEncoderContext*>(encodedInput.get())->encodedValue()->asObject());

    return serializedInput.release();
}

PassOwnPtr<EncoderContext> JSONCoder::createMap()
{
    return adoptPtr(new JSONMapEncoder());
}

PassOwnPtr<EncoderContext> JSONCoder::createList()
{
    return adoptPtr(new JSONListEncoder());
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
