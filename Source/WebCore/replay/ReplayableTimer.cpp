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
#include "Page.h"
#include "ReplayProxy.h"
#include <wtf/replay/InputIterator.h>

namespace WebCore {

ReplayableTimerBase::ReplayableTimerBase(Document* document)
    : m_timer(this, &ReplayableTimerBase::timerFired)
    , m_document(document)
    , m_isActive(false)
{
    if (document && document->page())
    m_identifier = (document && document->page()) ? document->page()->replayProxy().registerTimer(this) : 0;
}

ReplayableTimerBase::~ReplayableTimerBase()
{
    if (!m_document || !m_document->page())
        return;

    m_document->page()->replayProxy().unregisterTimer(this);
}

void ReplayableTimerBase::timerFired(Timer<ReplayableTimerBase>*)
{
    InputIterator* it = inputIterator();
    if (it && it->isCapturing()) {
        it->storeInput(std::make_unique<AsyncTimerFired>(m_identifier));
        EventLoopInputExtent extent(it);
        fired();
    }

    m_isActive = false;
}

void ReplayableTimerBase::startOneShot(double interval)
{
    if (inputIterator() && inputIterator()->isCapturing())
        m_timer.startOneShot(interval);

    m_isActive = true;
}

void ReplayableTimerBase::stop()
{
    if (inputIterator() && inputIterator()->isCapturing())
        m_timer.stop();

    m_isActive = false;
}

bool ReplayableTimerBase::isActive() const
{
    InputIterator* it = inputIterator();
    if (!it || (it && it->isCapturing()))
        return m_timer.isActive();

    return m_isActive;
}

InputIterator* ReplayableTimerBase::inputIterator() const
{
    return m_document ? m_document->inputIterator() : nullptr;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
