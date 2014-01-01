/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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
#include "CaptureInputIterator.h"

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputStorage.h"
#include "InspectorInstrumentation.h"
#include "Logging.h"
#include "Page.h"
#include <wtf/Vector.h>
#include <wtf/replay/NondeterministicInput.h>

namespace WebCore {

EventLoopInputExtent::EventLoopInputExtent(InputIterator* iterator)
    : m_iterator(iterator)
{
    if (!m_iterator || !m_iterator->isCapturing())
        return;

    static_cast<CaptureInputIterator*>(iterator)->setWithinInputExtent(true);
}

EventLoopInputExtent::~EventLoopInputExtent()
{
    if (!m_iterator || !m_iterator->isCapturing())
        return;

    static_cast<CaptureInputIterator*>(m_iterator)->setWithinInputExtent(false);
}

CaptureInputIterator::CaptureInputIterator(InputStorage* storage, Page* page)
: m_storage(storage)
, m_page(page)
, m_previousEventLoopInput(nullptr)
, m_elapsedTicks(0)
, m_withinInputExtent(false)
{
    ASSERT(m_page);
    ASSERT(m_storage && !m_storage->isReadOnly());
    LOG(DeterministicReplay, "%-30sCreated capture iterator=%p.\n", "[ReplayController]", (void*)this);
}

CaptureInputIterator::~CaptureInputIterator()
{
    if (m_previousEventLoopInput)
        finalizePreviousInput();

    m_storage->freeze();
    LOG(DeterministicReplay, "%-30sDestroyed capture iterator=%p.\n", "[ReplayController]", (void*)this);
}

void CaptureInputIterator::incrementExecutionTicks()
{
    ASSERT(withinInputExtent());
    m_elapsedTicks += 1;
}

void CaptureInputIterator::storeInput(std::unique_ptr<NondeterministicInput> input)
{
    ASSERT_ARG(input, input);
    ASSERT(isActive());

    if (input->queue() == NondeterministicInput::EventLoopInputQueue) {
        EventLoopInput* eventLoopInput = static_cast<EventLoopInput*>(input.get());
        if (m_previousEventLoopInput)
            finalizePreviousInput();
        m_previousEventLoopInput = eventLoopInput;
        InspectorInstrumentation::capturedEventLoopInput(m_page, eventLoopInput);
    }

    m_storage->store(std::move(input));
}

NondeterministicInput* CaptureInputIterator::loadInput(NondeterministicInput::QueueType, const AtomicString&)
{
    // Can't load inputs from capturing iterator.
    ASSERT_NOT_REACHED();
    return nullptr;
}

NondeterministicInput* CaptureInputIterator::uncheckedLoadInput(NondeterministicInput::QueueType)
{
    // Can't load inputs from capturing iterator.
    ASSERT_NOT_REACHED();
    return nullptr;
}

void CaptureInputIterator::finalizePreviousInput()
{
    m_previousEventLoopInput->setExecutionTicksQuota(m_elapsedTicks);
    m_previousEventLoopInput->seal();
    m_elapsedTicks = 0;
}

}; // namespace WebCore

#endif // ENABLE(TIMEALPSE)
