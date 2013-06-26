/*
 *  Copyright (C) 2013 Brian Burg.
 *  Copyright (C) 2013 University of Washington. All rights reserved.
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

#include "EventLoopInputDispatcher.h"
#include "InputStorage.h"
#include "ReplayInputIterator.h"

#include <wtf/Vector.h>
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/text/CString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/WTFString.h>

static const char* queueTypeToString(NondeterministicInput::QueueType queue) {
    switch (queue) {
        case NondeterministicInput::EventLoopInputQueue:        return "EventLoopInputQueue";
        case NondeterministicInput::LoaderMemoizedDataQueue:    return "LoaderMemoizedDataQueue";
        case NondeterministicInput::ScriptMemoizedDataQueue:    return "ScriptMemoizedDataQueue";
        case NondeterministicInput::QueueTypeLength:            return "QueueTypeLength (error)";
    }
}

namespace WebCore {

ReplayInputIterator::ReplayInputIterator(InputStorage* storage, Page* page, EventLoopInputDispatcherClient* client)
: m_storage(storage)
, m_isActive(true)
, m_dispatcher(EventLoopInputDispatcher::create(page, this, client))
, m_positions(Vector<size_t>()) {
    ASSERT(m_storage->isReadOnly());

    m_errorData.error = NoReplayError;
    for (size_t i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        m_positions.append(0);
    }
}

ReplayInputIterator::~ReplayInputIterator()
{
}

PassOwnPtr<ReplayInputIterator> ReplayInputIterator::create(InputStorage* storage, Page* page, EventLoopInputDispatcherClient* client)
{
    return adoptPtr(new ReplayInputIterator(storage, page, client));
}

void ReplayInputIterator::storeInput(PassOwnPtr<NondeterministicInput>)
{
    // cannot store inputs from replay iterator
    ASSERT_NOT_REACHED();
}

NondeterministicInput* ReplayInputIterator::loadInput(NondeterministicInput::QueueType queue, const AtomicString& type)
{
    if (hasError()) {
        LOG_ERROR("%-30s prior memoized value retrieval failed, so not consulting log and instead propagating error condition.",
                  "ReplayInputIterator::loadInput");
        return 0;
    }

    NondeterministicInput* input = uncheckedLoadInput(queue);

    if (input->type() != type) {
        LOG_ERROR("%-25s ERROR: Expected replay input of type %s, but got type %s (%s)\n",
                  "[ReplayInputIterator]",
                  type.string().ascii().data(),
                  input->type().string().ascii().data(),
                  input->toString().ascii().data());

        m_errorData.error = ErrorUnexpectedInputType;
        m_errorData.queue = queue;
        m_errorData.expectedInput = type;
        return 0;
    }

    return input;
}

NondeterministicInput* ReplayInputIterator::uncheckedLoadInput(NondeterministicInput::QueueType queue)
{
    ASSERT(m_isActive);
    // callers should check for errors before requesting inputs.
    // if an error exists, the caller should call reset() or clearError()
    ASSERT(!hasError());
    ASSERT(queue < NondeterministicInput::QueueTypeLength);

    if (m_positions[queue] >= m_storage->queueSize(queue)) {
        LOG_ERROR("%-30s ERROR No more inputs remain for determinism queue %s, but one was requested.",
                  "[ReplayInputIterator]",
                  queueTypeToString(queue));
        m_errorData.error = ErrorExhaustedQueue;
        m_errorData.queue = queue;
        return 0;
    }

    return m_storage->load(queue, m_positions[queue]++);
}

String ReplayInputIterator::errorMessage() const
{
    ASSERT(hasError());
    StringBuilder sb;

    switch (m_errorData.error) {
    case ErrorExhaustedQueue:
        ASSERT(m_errorData.queue < NondeterministicInput::QueueTypeLength);
        sb.append("Ran out of inputs on queue: ");
        sb.append(queueTypeToString(m_errorData.queue));
        sb.append(" because too many were requested.");
        break;

    case ErrorUnexpectedInputType: {
        NondeterministicInput::QueueType queue = m_errorData.queue;
        ASSERT(queue < NondeterministicInput::QueueTypeLength);
        sb.append("Expected next input to be a ");
        sb.append(m_errorData.expectedInput);
        sb.append(", but found a ");

        NondeterministicInput* input = m_storage->load(queue, m_positions[queue]);
        sb.append(input->type());
        sb.append("(detail: ");
        sb.append(input->toString());
        sb.append(")");
        break;
    }
    default:
        break;
    }

    return sb.toString();
}

void ReplayInputIterator::setIsActive(bool state)
{
    ASSERT(m_isActive != state);
    m_isActive = state;
}

}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
