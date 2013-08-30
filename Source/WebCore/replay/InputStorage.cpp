/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#include "InputStorage.h"

#include "Logging.h"
#include <wtf/Noncopyable.h>
#include <wtf/OwnPtr.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/Vector.h>
#include <wtf/text/CString.h>
#include <wtf/text/WTFString.h>


#if !defined(NDEBUG)
static const char* queueTypeToMiniString(NondeterministicInput::QueueType queue, bool isLoad) {
    if (isLoad)
        switch (queue) {
            case NondeterministicInput::EventLoopInputQueue:     return "(DSPTCH-LOAD)";
            case NondeterministicInput::LoaderMemoizedDataQueue: return "<LDMEMO-LOAD";
            case NondeterministicInput::ScriptMemoizedDataQueue: return "<---<---<---JSMEMO-LOAD";
            case NondeterministicInput::QueueTypeLength:         return "ERROR!";
        }
        
    else
        switch (queue) {
            case NondeterministicInput::EventLoopInputQueue:     return ">DSPTCH-STORE";
            case NondeterministicInput::LoaderMemoizedDataQueue: return "<LDMEMO-STORE";
            case NondeterministicInput::ScriptMemoizedDataQueue: return "<---<---<---JSMEMO-STORE";
            case NondeterministicInput::QueueTypeLength:         return "ERROR!";
        }
}
#endif

namespace WebCore {

InputStorage::InputStorage()
: m_inputCount(0)
, m_readOnly(false)
{
    for (size_t i = 0; i < NondeterministicInput::QueueTypeLength; i++)
        m_queues.append(new InputQueue());
}

InputStorage::~InputStorage()
{
    for (size_t i = 0; i < NondeterministicInput::QueueTypeLength; i++)
        delete m_queues.at(i);
}

PassOwnPtr<InputStorage> InputStorage::create()
{
    return adoptPtr(new InputStorage());
}

NondeterministicInput* InputStorage::load(NondeterministicInput::QueueType queue, uint offset)
{
    ASSERT(queue < NondeterministicInput::QueueTypeLength);
    ASSERT(offset < m_queues[queue]->size());

    NondeterministicInput* input = m_queues.at(queue)->at(offset).get();

    LOG(DeterministicReplay, "%-20s %s: %s\n", "ReplayEvents",
        queueTypeToMiniString(queue, true), input->toString().utf8().data());

    return input;
}

void InputStorage::store(PassOwnPtr<NondeterministicInput> input)
{
    ASSERT(input);
    ASSERT(input->queue() < NondeterministicInput::QueueTypeLength);

    LOG(DeterministicReplay, "%-14s#%-5u %s: %s \n", "ReplayEvents",
        m_inputCount++, queueTypeToMiniString(input->queue(), false),
        input->toString().utf8().data());

    m_queues.at(input->queue())->append(input);
}

void InputStorage::freeze()
{
    ASSERT(!m_readOnly);

    m_readOnly = true;
    for (size_t i = 0; i < m_queues.size(); i++)
        m_queues.at(i)->shrinkToFit();
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
