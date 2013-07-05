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

#ifndef FunctorInputIterator_h
#define FunctorInputIterator_h

#if ENABLE(WEB_REPLAY)

#include "InputStorage.h"

#include <wtf/Assertions.h>
#include <wtf/Noncopyable.h>
#include <wtf/OwnPtr.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/replay/InputIterator.h>
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/Vector.h>

namespace WebCore {

class FunctorInputIterator : public WTF::InputIterator {
    WTF_MAKE_NONCOPYABLE(FunctorInputIterator);
public:
    static PassOwnPtr<FunctorInputIterator> create(InputStorage*);
    virtual ~FunctorInputIterator() {}

    // InputIterator API
    virtual bool isCapturing() const { return false; }
    virtual bool isReplaying() const { return false; }

    virtual void storeInput(PassOwnPtr<NondeterministicInput>);
    virtual NondeterministicInput* loadInput(NondeterministicInput::QueueType, const AtomicString&);
    virtual NondeterministicInput* uncheckedLoadInput(NondeterministicInput::QueueType);

    template<typename Functor> typename Functor::ReturnType forEachInputInQueue(NondeterministicInput::QueueType, Functor&);

private:
    FunctorInputIterator(InputStorage*);

    InputStorage* m_storage;
};

template<typename Functor> inline typename Functor::ReturnType FunctorInputIterator::forEachInputInQueue(NondeterministicInput::QueueType queue, Functor& functor)
{
    ASSERT(queue < NondeterministicInput::QueueTypeLength);

    for (size_t i = 0; i < m_storage->m_queues[queue]->size(); i++) {
        functor(i, m_storage->m_queues[queue]->at(i).get());
    }

    return functor.returnValue();
}

inline FunctorInputIterator::FunctorInputIterator(InputStorage* storage)
: m_storage(storage)
{
}

inline PassOwnPtr<FunctorInputIterator> FunctorInputIterator::create(InputStorage* storage)
{
    return adoptPtr(new FunctorInputIterator(storage));
}

inline void FunctorInputIterator::storeInput(PassOwnPtr<NondeterministicInput>)
{
    ASSERT_NOT_REACHED();
}

inline NondeterministicInput* FunctorInputIterator::loadInput(NondeterministicInput::QueueType, const AtomicString&)
{
    ASSERT_NOT_REACHED();
    return 0;
}

inline NondeterministicInput* FunctorInputIterator::uncheckedLoadInput(NondeterministicInput::QueueType)
{
    ASSERT_NOT_REACHED();
    return 0;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // FunctorInputIterator_h
