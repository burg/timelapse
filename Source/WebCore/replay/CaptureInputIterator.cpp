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

#if ENABLE(TIMELAPSE)

#include "config.h"

#include "CaptureInputIterator.h"

#include "Document.h"
#include "DocumentEventQueue.h"
#include "EventLoopInput.h"
#include "Frame.h"
#include "InputStorage.h"
#include "InspectorInstrumentation.h"
#include "Logging.h"
#include "Page.h"
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/Vector.h>

namespace WebCore {

CaptureInputIterator::CaptureInputIterator(InputStorage* storage, Page* page)
: m_storage(storage)
, m_page(page)
, m_previousEventLoopInput(0)
, m_domEventDispatchCount(0)
, m_isActive(true)
{
    ASSERT(m_page);
    ASSERT(m_storage && !m_storage->isReadOnly());
}

CaptureInputIterator::~CaptureInputIterator()
{
    if (m_previousEventLoopInput)
        finalizePreviousInput();

    m_storage->freeze();
    LOG(DeterministicReplay, "%-30sDestroyed capture iterator=%p.\n", "[ReplayController]", (void*)this);
}

PassOwnPtr<CaptureInputIterator> CaptureInputIterator::create(InputStorage* storage, Page* page)
{
    CaptureInputIterator* it = new CaptureInputIterator(storage, page);
    LOG(DeterministicReplay, "%-30sCreated capture iterator=%p.\n", "[ReplayController]", (void*)it);
    return adoptPtr(it);
}

void CaptureInputIterator::storeInput(PassOwnPtr<NondeterministicInput> input)
{
    ASSERT_ARG(input, input != NULL);
    ASSERT(m_isActive);

    if (input->queue() == NondeterministicInput::EventLoopInputQueue) {
        // flush document event queue, so event dispatch count reflects anything
        // dispatched or queued before this input was captured.
        m_page->mainFrame()->document()->eventQueue()->flush();

        EventLoopInput* eventLoopInput = static_cast<EventLoopInput*>(input.get());
        eventLoopInput->setDispatchCount(m_domEventDispatchCount);
        if (m_previousEventLoopInput)
            finalizePreviousInput();
        m_previousEventLoopInput = eventLoopInput;
        InspectorInstrumentation::capturedEventLoopInput(m_page, eventLoopInput);
    }

    m_storage->store(input);
}

NondeterministicInput* CaptureInputIterator::loadInput(NondeterministicInput::QueueType, const AtomicString&)
{
    // can't load inputs from capturing iterator.
    ASSERT_NOT_REACHED();
    return 0;
}

NondeterministicInput* CaptureInputIterator::uncheckedLoadInput(NondeterministicInput::QueueType)
{
    // can't load inputs from capturing iterator.
    ASSERT_NOT_REACHED();
    return 0;
}

void CaptureInputIterator::setIsActive(bool state)
{
    ASSERT(m_isActive != state);
    m_isActive = state;
}

void CaptureInputIterator::finalizePreviousInput()
{
    int eventQuota = m_domEventDispatchCount - m_previousEventLoopInput->dispatchCount();
    m_previousEventLoopInput->setDOMEventQuota(eventQuota);
    m_previousEventLoopInput->seal();
}

}; // namespace WebCore

#endif // ENABLE(TIMEALPSE)
