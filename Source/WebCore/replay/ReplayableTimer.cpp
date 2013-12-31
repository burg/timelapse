/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"
#include "ReplayableTimer.h"

#if ENABLE(WEB_REPLAY)

#include "AsyncTimerFired.h"
#include "CaptureInputIterator.h"
#include "Document.h"
#include "EventLoopInput.h"
#include "Logging.h"
#include "ReplayableTimers.h"
#include <wtf/replay/InputIterator.h>

namespace WebCore {

ReplayableTimerBase::ReplayableTimerBase()
    : m_timer(this, &ReplayableTimerBase::timerFired)
    , m_document(nullptr)
    , m_identifier(0)
{
}

ReplayableTimerBase::~ReplayableTimerBase()
{
}

void ReplayableTimerBase::timerFired(Timer<ReplayableTimerBase>*)
{
    LOG(DeterministicReplay, "ReplayableTimer(%p)::timerFired m_document=%p", (void*)this, (void*)m_document);

    ASSERT(m_document);
    Document* document = m_document;
    m_document = nullptr;

    InputIterator* it = document->inputIterator();
    if (!it)
        fired();
    else if (it->isCapturing()) {
        it->storeInput(std::make_unique<AsyncTimerFired>(frameIndexFromDocument(document), m_identifier));
        EventLoopInputExtent extent(it);
        fired();
    }
}

void ReplayableTimerBase::startOneShot(double interval, Document* document)
{
    LOG(DeterministicReplay, "ReplayableTimer(%p)::startOneShot interval=%f, document=%p", (void*)this, interval, (void*)document);

    ASSERT(document);
    m_document = document;
    // Reassign identifier on every request. It will be a new identifier
    // if the document's timer map has never seen this timer before.
    m_identifier = document->replayableTimers().registerTimer(this);

    InputIterator* it = document->inputIterator();
    if (!it || it->isCapturing())
        m_timer.startOneShot(interval);
}

void ReplayableTimerBase::stop()
{
    LOG(DeterministicReplay, "ReplayableTimer(%p)::stop m_document=%p", (void*)this, (void*)m_document);

    if (!m_document) {
        m_timer.stop();
        return;
    }

    InputIterator* it = m_document->inputIterator();
    if (!it || it->isCapturing())
        m_timer.stop();

    m_document = nullptr;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
