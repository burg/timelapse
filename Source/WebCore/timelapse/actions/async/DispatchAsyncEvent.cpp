/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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

#include "DispatchAsyncEvent.h"

#include "AsyncEventProxy.h"
#include "DeterminismController.h"
#include "Document.h"
#include "Event.h"
#include "DispatchEventBase.h"
#include "Frame.h"
#include "History.h"
#include "Node.h"
#include "Page.h"
#include "PageTransitionEvent.h"
#include "PopStateEvent.h"
#include "ReplayableTypes.h"
#include "SerializedScriptValue.h"
#include <wtf/Assertions.h>
#include <wtf/text/AtomicString.h>
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

// TODO: for async events with more data than cancelable and bubbles flags,
// consult ~/Desktop/old_DispatchKeyboardEvent.{cpp,h} to see how it was done before.

DispatchAsyncEvent::DispatchAsyncEvent(PassRefPtr<Event> event, PassRefPtr<EventTarget> eventTarget)
    : DispatchEventBase(ReplayableTypes::DispatchAsyncEvent)
    , m_event(SerializedGenericEvent::serialize(event.get()))
    , m_eventTarget(SerializedEventTarget::serialize(eventTarget.get()))
{
    if (isSimpleEvent())
        return;
        
    if (isPopstateEvent()) {
        PopStateEvent* ev = static_cast<PopStateEvent*>(event.get());
        m_historyState = ev->serializedState();
        return;
    }
    
    if (isPageTransitionEvent()) {
        PageTransitionEvent* ev = static_cast<PageTransitionEvent*>(event.get());
        m_pageTransitionEventPersisted = ev->persisted();
        return;
     }
    
    // we should have serialized the value in one of the cases above.
    ASSERT_NOT_REACHED();
}

DispatchAsyncEvent::~DispatchAsyncEvent()
{

}

String DispatchAsyncEvent::toString() const
{
    StringBuilder sb;
    sb.append("DispatchAsyncEvent(");
    sb.append(makeString("type=", m_event.type(), ";"));

    if (isPopstateEvent())
        sb.append(" history=<serialized value>; ");

    if (isPageTransitionEvent())
        sb.append(makeString(" persisted=",
                             (m_pageTransitionEventPersisted) ? "true" : "false",
                             ";"));

    sb.append(")");
    return sb.toString();
}


size_t DispatchAsyncEvent::memorySize() const
{
    size_t size = sizeof(DispatchAsyncEvent);

    if (isPopstateEvent())
        size += m_historyState->data().capacity(); // vector of uchar

    return size;
}

void DispatchAsyncEvent::serialize(ActionSerializer* serializer) const
{
    serializer->putString("eventType", m_event.type());

    // FIXME: this hits an assertion inside CloneDeserializer. Are we using it wrong?
    //if (isPopstateEvent())
    //    serializer->putString("historyState", m_historyState->toString());

    if (isPageTransitionEvent())
        serializer->putBoolean("pageTransitionEventPersisted", m_pageTransitionEventPersisted);
}

EventTarget* DispatchAsyncEvent::target(Page* page)
{
    return m_eventTarget.deserialize(page);
}

PassRefPtr<Event> DispatchAsyncEvent::event(Page* page)
{
    if (isSimpleEvent())
        return m_event.deserialize(page);

    if (isPopstateEvent()) {
        Document* document = m_eventTarget.document(page);
        return PopStateEvent::create(m_historyState,
                                     (document->domWindow()) ? document->domWindow()->history() : 0);

    }

    if (isPageTransitionEvent())
        return PageTransitionEvent::create(m_event.type(), m_pageTransitionEventPersisted);
    
    ASSERT_NOT_REACHED();
    return 0;
}

void DispatchAsyncEvent::dispatch(DeterminismController* controller)
{
    Page* page = controller->page();
    page->asyncEventProxy()->dispatchAsyncEvent(event(page), target(page), true);
    controller->didDispatch(this);
}

bool DispatchAsyncEvent::isSimpleEvent() const
{
    const AtomicString& eventType = m_event.type();

    return eventType == eventNames().beforeunloadEvent ||
           eventType == eventNames().DOMContentLoadedEvent ||
           eventType == eventNames().errorEvent ||
           eventType == eventNames().loadEvent ||
           eventType == eventNames().readystatechangeEvent;
}

bool DispatchAsyncEvent::isPopstateEvent() const
{
    return (m_event.type() == eventNames().popstateEvent);
}

bool DispatchAsyncEvent::isPageTransitionEvent() const
{
    return (m_event.type() == eventNames().pageshowEvent);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
