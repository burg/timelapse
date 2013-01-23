/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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

#include "AsyncEventProxy.h"

#include "DeterminismController.h"
#include "DispatchAsyncEvent.h"
#include "DispatchFakeMouseMove.h"
#include "Document.h"
#include "DOMWindow.h"
#include "Event.h"
#include "Frame.h"
#include "Location.h"
#include "Logging.h"
#include "Node.h"
#include "Page.h"

namespace WebCore {

#if ENABLE(TIMELAPSE)

#if !LOG_DISABLED
static void dumpEventDispatchInfo(RefPtr<Event> event, RefPtr<EventTarget> eventTarget, bool wasIgnored)
{
    if (!eventTarget)
        return;
        
    if (Node* node = eventTarget->toNode())
        LOG(Timelapse, "%-30s %s event: type=%s, target=%d/node[%p] %s\n", "[AsyncEventProxy]",
            (wasIgnored) ? "IGNORED" : "Received",
            event->type().string().utf8().data(),
            SerializedEventTarget::frameIndexFromDocument((node->inDocument()) ? node->document() : node->ownerDocument()),
            (void*)node,
            node->nodeName().utf8().data());

    if (DOMWindow* window = eventTarget->toDOMWindow())
        LOG(Timelapse, "%-30s %s event: type=%s, target=%d/window[%p] %s\n", "[AsyncEventProxy]",
            (wasIgnored) ? "IGNORED" : "Received",
            event->type().string().utf8().data(),
            SerializedEventTarget::frameIndexFromDocument(window->document()),
            (void*)window,
            window->location()->href().utf8().data());
}
#endif // !LOG_DISABLED

static bool isCapturableEventType(const AtomicString&)
{
    return false;
/*    return (eventType == eventNames().beforeunloadEvent ||
            eventType == eventNames().DOMContentLoadedEvent ||
            eventType == eventNames().errorEvent ||
            eventType == eventNames().loadEvent ||
            eventType == eventNames().popstateEvent ||
            eventType == eventNames().pageshowEvent ||
            eventType == eventNames().readystatechangeEvent); */
}
#endif // ENABLE(TIMELAPSE)

AsyncEventProxy::AsyncEventProxy(Page* page)
: TimelapseProxy(page) {}

PassOwnPtr<AsyncEventProxy> AsyncEventProxy::create(Page* page)
{
    return adoptPtr(new AsyncEventProxy(page));
}

void AsyncEventProxy::dispatchFakeMouseMove(Frame* frame, const PlatformMouseEvent& fakeMouseMove, bool fromReplay)
{
    ASSERT(frame);
#if ENABLE(TIMELAPSE)
    if (mode() == TimelapseProxy::Replaying && !fromReplay)
        return;
    
    if (mode() == TimelapseProxy::Capturing)
        m_page->determinismController()->capturePageInput(new DispatchFakeMouseMove(frame, fakeMouseMove));
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)

    frame->eventHandler()->mouseMoved(fakeMouseMove);
}

bool AsyncEventProxy::dispatchAsyncEvent(PassRefPtr<Event> prpEvent, PassRefPtr<EventTarget> prpEventTarget, bool fromReplay)
{
    RefPtr<Event> event(prpEvent);
    RefPtr<EventTarget> eventTarget(prpEventTarget);

#if ENABLE(TIMELAPSE)
    bool shouldIgnoreDispatchRequest = (mode() == TimelapseProxy::Replaying && !fromReplay && isCapturableEventType(event->type()));

#if !LOG_DISABLED
    if (mode() != TimelapseProxy::Open)
        dumpEventDispatchInfo(event, eventTarget, shouldIgnoreDispatchRequest);
#endif // !LOG_DISABLED

    if (shouldIgnoreDispatchRequest)
        return false;
        
    if (mode() == TimelapseProxy::Capturing && isCapturableEventType(event->type()))
        m_page->determinismController()->capturePageInput(new DispatchAsyncEvent(event, eventTarget));
#else
    UNUSED_PARAM(fromReplay);
#endif // ENABLE(TIMELAPSE)
    
    return AsyncEventProxy::dispatchEvent(event, eventTarget);
}

bool AsyncEventProxy::dispatchEvent(PassRefPtr<Event> event, PassRefPtr<EventTarget> eventTarget)
{
    //must dispatch differently depending on target type. Node overrides 
    //EventTarget::dispatchEvent, but DOMWindow implements this dispatch in overloaded function.
    if (Node* node = eventTarget->toNode())
        return node->dispatchEvent(event);
    
    if (DOMWindow* window = eventTarget->toDOMWindow())
        return window->dispatchEvent(event, window->document());

    ASSERT_NOT_REACHED();
    return false;
}

} // namespace WebCore
