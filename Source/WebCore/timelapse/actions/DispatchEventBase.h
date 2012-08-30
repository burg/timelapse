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

#ifndef DispatchEventBase_h
#define DispatchEventBase_h

#if ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include "EventNames.h"
#include <wtf/PassRefPtr.h>
#include <wtf/timelapse/ReplayableAction.h>

namespace WebCore {

class DeterminismController;
class Document;
class Event;
class EventTarget;
class Frame;
class Node;
class Page;

// a struct to serialize DOM event targets in a Document
struct SerializedEventTarget {
public:
    enum TargetType {
        NODE,
        WINDOW,
        NONE
    };

    static int frameIndexFromDocument(Document*);
    static Document* documentFromFrameIndex(Page*, int);
    
    static SerializedEventTarget serialize(EventTarget*);
    EventTarget* deserialize(Page*);
    void serialize(WTF::ActionSerializer*) const;
    
    Document* document(Page*);
private:
    SerializedEventTarget(TargetType type, int nodeIndex, int frameIndex)
        : m_targetType(type)
        , m_nodeIndex(nodeIndex)
        , m_frameIndex(frameIndex) {}

    TargetType m_targetType;
    int m_nodeIndex;
    int m_frameIndex;
};

enum SerializedEventName {
#define EVENT_ENUM_VALUE(name) name##_SerializedEventName,
    DOM_EVENT_NAMES_FOR_EACH(EVENT_ENUM_VALUE)
#undef EVENT_ENUM_VALUE
};

SerializedEventName serializeEventName(const AtomicString&);
const AtomicString& deserializeEventName(SerializedEventName);

// a struct to serialize the Event class
struct SerializedGenericEvent {
public:
    static SerializedGenericEvent serialize(Event*);
    void serialize(WTF::ActionSerializer*) const;
    PassRefPtr<Event> deserialize(Page*);
    SerializedEventName name() const { return m_name; }
    const AtomicString& type() const { return deserializeEventName(m_name); }
private:
    SerializedGenericEvent(SerializedEventName name, bool canBubble, bool cancelable)
        : m_name(name)
        , m_canBubble(canBubble)
        , m_cancelable(cancelable) {}

    SerializedEventName m_name;
    bool m_canBubble;
    bool m_cancelable;
};

class DispatchEventBase : public DispatchableAction {

public:
    DispatchEventBase(ReplayableAction::ReplayableType type)
    : DispatchableAction(type) {}
    virtual ~DispatchEventBase() {}

    virtual PassRefPtr<Event> event(Page*) =0;
    virtual EventTarget* target(Page*) =0;
    virtual bool syncDomDispatch(DeterminismController*);

    static bool domDispatch(PassRefPtr<Event>, PassRefPtr<EventTarget>);
};

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // DispatchEventBase_h
