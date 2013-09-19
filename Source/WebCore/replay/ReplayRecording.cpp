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

#if ENABLE(WEB_REPLAY)

#include "ReplayRecording.h"

#include "CaptureInputIterator.h"
#include "FunctorInputIterator.h"
#include "InputStorage.h"
#include "ReplayInputIterator.h"
#include <wtf/CurrentTime.h>

namespace WebCore {

PassRefPtr<ReplayRecording> ReplayRecording::create(int uid)
{
    return adoptRef(new ReplayRecording(uid));
}

ReplayRecording::ReplayRecording(int uid)
: m_inputStorage(InputStorage::create())
, m_uid(uid)
, m_canCapture(true)
, m_timestamp(WTF::currentTimeMS()) { }

ReplayRecording::~ReplayRecording()
{}

PassOwnPtr<CaptureInputIterator> ReplayRecording::createCaptureIterator(Page* page)
{
    ASSERT(m_canCapture);
    m_canCapture = false;
    return CaptureInputIterator::create(m_inputStorage.get(), page);
}

PassOwnPtr<ReplayInputIterator> ReplayRecording::createReplayIterator(Page* page, EventLoopInputDispatcherClient* client)
{
    return ReplayInputIterator::create(m_inputStorage.get(), page, client);
}

PassOwnPtr<FunctorInputIterator> ReplayRecording::createFunctorIterator()
{
    return FunctorInputIterator::create(m_inputStorage.get());
}

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

size_t ReplayRecording::memorySize()
{
    CountMemorySize counter;

    for (int i = 0; i < NondeterministicInput::QueueTypeLength; i++) {
        NondeterministicInput::QueueType queueType = static_cast<NondeterministicInput::QueueType>(i);
        createFunctorIterator()->forEachInputInQueue(queueType, counter);
    }

    return counter.returnValue();
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
