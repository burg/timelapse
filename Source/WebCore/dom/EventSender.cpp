/*
 * Copyright (C) 2012 Apple Inc. All rights reserved.
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
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */


#include "config.h"
#include "EventSender.h"

#include "Document.h"
#include "EventSenderClient.h"

namespace WebCore {

EventSender::EventSender(Document& document)
    : m_timer(this, &EventSender::timerFired, &document)
{
}

void EventSender::dispatchEventSoon(EventSenderClient* sender, const AtomicString& eventName)
{
    m_dispatchSoonList.append(std::make_pair(sender, eventName));

    if (!m_timer.isActive())
        m_timer.startOneShot(0);
}

void EventSender::cancelEventForSender(EventSenderClient* sender, const AtomicString& eventName)
{
    // Remove instances of this sender from both lists.
    // Use loops because we allow multiple instances to get into the lists.
    size_t size = m_dispatchSoonList.size();
    for (size_t i = 0; i < size; ++i) {
        if (m_dispatchSoonList[i].first == sender && m_dispatchSoonList[i].second == eventName)
            m_dispatchSoonList[i].first = 0;
    }
    size = m_dispatchingList.size();
    for (size_t i = 0; i < size; ++i) {
        if (m_dispatchingList[i].first == sender && m_dispatchingList[i].second == eventName)
            m_dispatchingList[i].first = 0;
    }
}

void EventSender::dispatchPendingEventsWithType(const AtomicString& eventName)
{
    // Need to avoid re-entering this function; if new dispatches are
    // scheduled before the parent finishes processing the list, they
    // will set a timer and eventually be processed.
    if (!m_dispatchingList.isEmpty())
        return;

    m_dispatchSoonList.checkConsistency();

    m_dispatchingList.swap(m_dispatchSoonList);
    size_t size = m_dispatchingList.size();
    for (size_t i = 0; i < size; ++i) {
        // The sender may have been zeroed out if it was cancelled.
        EventSenderClient* currentSender = m_dispatchingList[i].first;
        const AtomicString& currentEventName = m_dispatchingList[i].second;
        if (!currentSender || eventName != currentEventName)
            continue;
        m_dispatchingList[i].first = 0;
        currentSender->dispatchPendingEvent(eventName);
    }
    m_dispatchingList.clear();
}

void EventSender::dispatchAllPendingEvents()
{
    // Need to avoid re-entering this function; if new dispatches are
    // scheduled before the parent finishes processing the list, they
    // will set a timer and eventually be processed.
    if (!m_dispatchingList.isEmpty())
        return;

    m_dispatchSoonList.checkConsistency();

    m_dispatchingList.swap(m_dispatchSoonList);
    size_t size = m_dispatchingList.size();
    for (size_t i = 0; i < size; ++i) {
        // The sender may have been zeroed out if it was cancelled.
        if (EventSenderClient* sender = m_dispatchingList[i].first) {
            const AtomicString& eventName = m_dispatchingList[i].second;
            m_dispatchingList[i].first = 0;
            sender->dispatchPendingEvent(eventName);
        }
    }
    m_dispatchingList.clear();
}

bool EventSender::hasPendingEventsForSender(const EventSenderClient* sender) const
{
    // Use loops because we allow multiple instances to get into the lists.
    size_t size = m_dispatchSoonList.size();
    for (size_t i = 0; i < size; ++i) {
        if (m_dispatchSoonList[i].first == sender)
            return true;
    }
    size = m_dispatchingList.size();
    for (size_t i = 0; i < size; ++i) {
        if (m_dispatchingList[i].first == sender)
            return true;
    }

    return false;
}

void EventSender::timerFired(ReplayableTimer<EventSender>*)
{
    m_timer.stop();
    dispatchAllPendingEvents();
}

} // namespace WebCore
