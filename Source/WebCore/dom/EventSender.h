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

#ifndef EventSender_h
#define EventSender_h

#include "ReplayableTimer.h"
#include <wtf/Vector.h>
#include <wtf/text/AtomicString.h>

namespace WebCore {

class Document;
class EventSenderClient;

class EventSender {
    WTF_MAKE_NONCOPYABLE(EventSender); WTF_MAKE_FAST_ALLOCATED;
public:
    EventSender(Document&);

    void dispatchEventSoon(EventSenderClient*, const AtomicString&);
    void cancelEventForSender(EventSenderClient*, const AtomicString&);
    bool hasPendingEventsForSender(const EventSenderClient* sender) const;

    void dispatchAllPendingEvents();
    void dispatchPendingEventsWithType(const AtomicString&);
private:
    void timerFired(ReplayableTimer<EventSender>*);

    ReplayableTimer<EventSender> m_timer;

    Vector<std::pair<EventSenderClient*, AtomicString>> m_dispatchSoonList;
    Vector<std::pair<EventSenderClient*, AtomicString>> m_dispatchingList;
};

} // namespace WebCore

#endif // EventSender_h
