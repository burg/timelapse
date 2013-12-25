/*
 * Copyright (C) 2006 Apple Computer, Inc.  All rights reserved.
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

#ifndef ReplayableTimer_h
#define ReplayableTimer_h

#include "Timer.h"
#include <wtf/Noncopyable.h>
#include <wtf/Threading.h>
#include <wtf/Vector.h>
#include <wtf/replay/InputIterator.h>

namespace WebCore {

class AsyncTimerFired;
class Document;

// Time intervals are all in seconds.

#if ENABLE(WEB_REPLAY)

class ReplayableTimerBase {
    WTF_MAKE_NONCOPYABLE(ReplayableTimerBase);
    WTF_FASTMALLOC_OPERATORS;

friend class AsyncTimerFired;

public:
    ReplayableTimerBase(Document*);
    virtual ~ReplayableTimerBase();

    void startOneShot(double interval);
    void stop();
    bool isActive() const;

    unsigned long identifier() const { return m_identifier; }
protected:
    virtual void fired() =0;
private:
    void timerFired(Timer<ReplayableTimerBase>*);
    InputIterator* inputIterator() const;

    Timer<ReplayableTimerBase> m_timer;
    unsigned long m_identifier;
    Document* m_document;
    bool m_isActive;
};

template <typename TimerFiredClass> class ReplayableTimer : public ReplayableTimerBase {
public:
    typedef void (TimerFiredClass::*TimerFiredFunction)(ReplayableTimer*);

    ReplayableTimer(TimerFiredClass* o, TimerFiredFunction f, Document* document)
        : ReplayableTimerBase(document)
        , m_object(o)
        , m_function(f) { }

protected:
    virtual void fired() OVERRIDE { (m_object->*m_function)(this); }

    TimerFiredClass* m_object;
    TimerFiredFunction m_function;
};

#else // !ENABLE(WEB_REPLAY)

// This is the same definition as in Timer.h, but takes a Document argument
// so that clients need not manually instantiate different Timers based on guards.
template <typename TimerFiredClass> class ReplayableTimer : public TimerBase {
public:
    typedef void (TimerFiredClass::*TimerFiredFunction)(ReplayableTimer*);

    ReplayableTimer(TimerFiredClass* o, TimerFiredFunction f, Document*)
        : m_object(o), m_function(f) { }

private:
    virtual void fired() OVERRIDE { (m_object->*m_function)(this); }

    TimerFiredClass* m_object;
    TimerFiredFunction m_function;
};

#endif

} // namespace WebCore

#endif // ReplayableTimer_h
