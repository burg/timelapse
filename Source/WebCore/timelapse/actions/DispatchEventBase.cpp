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

#include "DispatchEventBase.h"

#include "AsyncEventProxy.h"
#include "DeterminismController.h"
#include "Document.h"
#include "DOMWindow.h"
#include "Event.h"
#include "EventNames.h"
#include "EventTarget.h"
#include "Frame.h"
#include "FrameTree.h"
#include "Logging.h"
#include "Node.h"
#include "Page.h"
#include <wtf/Assertions.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

int SerializedEventTarget::frameIndexFromDocument(Document* document)
{
    ASSERT(document);
    ASSERT(document->frame());
    
    int idx = 0;
    Frame* targetFrame = document->frame();
    Frame* mainFrame = targetFrame->tree()->top();
    for (Frame* frame = mainFrame; frame; idx++, frame = frame->tree()->traverseNext(mainFrame))
        if (frame == targetFrame)
            return idx;
            
    ASSERT_NOT_REACHED();
    return 0;
}

Document* SerializedEventTarget::documentFromFrameIndex(Page* page, int frameIndex)
{
    ASSERT(page && page->mainFrame());
    ASSERT(frameIndex >= 0);

    Frame* mainFrame = page->mainFrame();
    Frame* frame = mainFrame;
    int idx = 0;
    for (; idx < frameIndex && frame; idx++, frame = frame->tree()->traverseNext(mainFrame));
        
    ASSERT(idx == frameIndex);
    ASSERT(frame && frame->document());
    return frame->document();
}

SerializedEventTarget SerializedEventTarget::serialize(EventTarget* target)
{
    TargetType targetType;
    int nodeIndex = -1;
    int frameIndex = -1;

    if (!target || target->toDOMWindow()) {
        //case: target is a DOMWindow (implicit if null)
        targetType = WINDOW;
        if (DOMWindow* window = target->toDOMWindow())
            frameIndex = frameIndexFromDocument(window->document());
        else
            frameIndex = 0;
    } else if (Node* node = target->toNode()) {
        //case: target is a Node
        ASSERT(node);
        ASSERT(node->inDocument() || node->ownerDocument());
        targetType = NODE;
        Document* nodeDocument = (node->inDocument()) ? node->document() : node->ownerDocument();
        nodeIndex = nodeDocument->nodeAbsIndex(node);
        frameIndex = frameIndexFromDocument(nodeDocument);
    } else {
        targetType = NONE;
        ASSERT_NOT_REACHED();
    }
    
    return SerializedEventTarget(targetType, nodeIndex, frameIndex);
}

void SerializedEventTarget::serialize(ActionSerializer* serializer) const
{
    serializer->putString("eventTarget_type", (m_targetType == NODE) ? "NODE" : "WINDOW");
    serializer->putInt("eventTarget_nodeIndex", m_nodeIndex);
    serializer->putInt("eventTarget_FrameIndex", m_frameIndex);
}

EventTarget* SerializedEventTarget::deserialize(Page* page)
{
    Document* targetDocument = documentFromFrameIndex(page, m_frameIndex);

    switch (m_targetType) {
    case NODE:
        return targetDocument->nodeWithAbsIndex(m_nodeIndex);
    case WINDOW:
        return static_cast<EventTarget*>(targetDocument->domWindow());
    case NONE:
        return 0;
    default:
        ASSERT_NOT_REACHED();
        return 0;
    }
}

Document* SerializedEventTarget::document(Page* page)
{
    return documentFromFrameIndex(page, m_frameIndex);
}

SerializedGenericEvent SerializedGenericEvent::serialize(Event* event)
{
    return SerializedGenericEvent(serializeEventName(event->type()),
                                 event->bubbles(),
                                 event->cancelable());
}

void SerializedGenericEvent::serialize(ActionSerializer* serializer) const
{
    serializer->putString("event_name", deserializeEventName(m_name));
    serializer->putBoolean("event_canBubble", m_canBubble);
    serializer->putBoolean("event_cancelable", m_cancelable);
}

PassRefPtr<Event> SerializedGenericEvent::deserialize(Page*)
{
    return Event::create(deserializeEventName(m_name), 
                         m_canBubble,
                         m_cancelable);
}

bool DispatchEventBase::syncDomDispatch(DeterminismController* controller)
{
    EventTarget* eventTarget = target(controller->page());
    ASSERT(eventTarget);
    RefPtr<Event> ev = event(controller->page());

    ev->setTarget(eventTarget);
    bool ret = AsyncEventProxy::dispatchEvent(ev, eventTarget);
    controller->didDispatch(this);
    return ret;
}

SerializedEventName serializeEventName(const AtomicString& type)
{
#define TEST_EVENT_TYPE(name)                                                  \
    if (type == eventNames().name##Event)                                      \
        return name##_SerializedEventName;
    DOM_EVENT_NAMES_FOR_EACH(TEST_EVENT_TYPE)
#undef TEST_EVENT_TYPE
    ASSERT_NOT_REACHED();
    return abort_SerializedEventName;
}

const AtomicString& deserializeEventName(SerializedEventName name)
{
    switch (name) {
#define CASE_EVENT_TYPE(name)                                                   \
        case name##_SerializedEventName :                                       \
        return eventNames().name##Event;
    DOM_EVENT_NAMES_FOR_EACH(CASE_EVENT_TYPE)
#undef CASE_EVENT_TYPE
    default:
        ASSERT_NOT_REACHED();
        return eventNames().abortEvent;
    }
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
