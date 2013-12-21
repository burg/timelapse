/*
 * Copyright (C) 2010 Google Inc. All Rights Reserved.
 * Copyright (C) 2013 Apple Inc. All Rights Reserved.
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
 *
 */

#include "config.h"
#include "DocumentEventQueue.h"

#include "DOMWindow.h"
#include "Document.h"
#include "Event.h"
#include "EventNames.h"
#include <wtf/Ref.h>

namespace WebCore {

static const AtomicString& emptyQueueEvent()
{
    DEFINE_STATIC_LOCAL(AtomicString, name, ("emptyqueue", AtomicString::ConstructFromLiteral));
    return name;
}

DocumentEventQueue::DocumentEventQueue(Document& document)
    : ActiveDOMObject(&document)
    , m_document(document)
    , m_isClosed(false)
    , m_suspended(false)
{
    suspendIfNeeded();
}

DocumentEventQueue::~DocumentEventQueue()
{
}

bool DocumentEventQueue::hasPendingActivity() const
{
    return m_document.eventSender().hasPendingEventsForSender(this) || !m_queuedEvents.isEmpty();
}

void DocumentEventQueue::stop()
{
    if (!m_suspended)
        flush();

    // It is not allowed for an ActiveDOMObject to become active again after stop().
    close();
}

void DocumentEventQueue::suspend(ReasonForSuspension)
{
    ASSERT(!m_suspended);
    m_suspended = true;

    if (m_document.eventSender().hasPendingEventsForSender(this))
        m_document.eventSender().cancelEventForSender(this, emptyQueueEvent());
}

void DocumentEventQueue::resume()
{
    ASSERT(m_suspended);
    m_suspended = false;

    if (!m_isClosed && !m_queuedEvents.isEmpty())
        m_document.eventSender().dispatchEventSoon(this, emptyQueueEvent());
}

bool DocumentEventQueue::canSuspend() const
{
    return true;
}

bool DocumentEventQueue::enqueueEvent(PassRefPtr<Event> event)
{
    ASSERT(event->target());
    ASSERT(!m_queuedEvents.contains(event.get()));

    if (m_isClosed)
        return false;

    m_queuedEvents.add(event);
    if (!m_document.eventSender().hasPendingEventsForSender(this))
        m_document.eventSender().dispatchEventSoon(this, emptyQueueEvent());
    return true;
}

void DocumentEventQueue::enqueueOrDispatchScrollEvent(Node& target)
{
    ASSERT(&target.document() == &m_document);

    if (m_isClosed)
        return;

    if (!m_document.hasListenerType(Document::SCROLL_LISTENER))
        return;

    if (!m_nodesWithQueuedScrollEvents.add(&target).isNewEntry)
        return;

    // Per the W3C CSSOM View Module, scroll events fired at the document should bubble, others should not.
    bool bubbles = target.isDocumentNode();
    bool cancelable = false;

    RefPtr<Event> scrollEvent = Event::create(eventNames().scrollEvent, bubbles, cancelable);
    scrollEvent->setTarget(&target);
    enqueueEvent(scrollEvent.release());
}

bool DocumentEventQueue::cancelEvent(Event& event)
{
    bool found = m_queuedEvents.remove(&event);
    if (m_document.eventSender().hasPendingEventsForSender(this) && m_queuedEvents.isEmpty())
        m_document.eventSender().cancelEventForSender(this, emptyQueueEvent());
    return found;
}

void DocumentEventQueue::close()
{
    m_isClosed = true;
    m_suspended = true;
    if (m_document.eventSender().hasPendingEventsForSender(this))
        m_document.eventSender().cancelEventForSender(this, emptyQueueEvent());
    m_queuedEvents.clear();
}

void DocumentEventQueue::flush()
{
    // If there is an event pending, cancel and fire pre-emptively.
    if (m_queuedEvents.isEmpty())
        return;

    if (m_document.eventSender().hasPendingEventsForSender(this))
        m_document.eventSender().cancelEventForSender(this, emptyQueueEvent());

    dispatchPendingEvent(emptyQueueEvent());
}

void DocumentEventQueue::dispatchPendingEvent(const AtomicString& eventName)
{
    ASSERT(!m_queuedEvents.isEmpty());
    ASSERT_UNUSED(eventName, eventName == emptyQueueEvent());

    m_nodesWithQueuedScrollEvents.clear();

    // Insert a marker for where we should stop.
    ASSERT(!m_queuedEvents.contains(nullptr));
    m_queuedEvents.add(nullptr);

    Ref<Document> protect(m_document);

    while (!m_queuedEvents.isEmpty()) {
        RefPtr<Event> event = m_queuedEvents.takeFirst();
        if (!event)
            break;
        dispatchEvent(*event);
    }
}

void DocumentEventQueue::dispatchEvent(Event& event)
{
    // FIXME: Where did this special case for the DOM window come from?
    // Why do we have this special case here instead of a virtual function on EventTarget?
    EventTarget& eventTarget = *event.target();
    if (DOMWindow* window = eventTarget.toDOMWindow())
        window->dispatchEvent(&event, 0);
    else
        eventTarget.dispatchEvent(&event);
}

}
