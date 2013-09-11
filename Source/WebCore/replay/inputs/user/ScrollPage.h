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

#ifndef ScrollPage_h
#define ScrollPage_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputCoder.h"
#include "ScrollTypes.h"

namespace WebCore {

class ReplayController;

class ScrollPage : public EventLoopInput {

public:
    ScrollPage(ScrollDirection direction, ScrollGranularity granularity)
        : m_isLogicalScroll(false)
        , m_granularity(granularity)
        {
            m_direction.normal = direction;
        }

    ScrollPage(ScrollLogicalDirection logicalDirection, ScrollGranularity granularity)
        : m_isLogicalScroll(true)
        , m_granularity(granularity)
        {
            m_direction.logical = logicalDirection;
        }

    virtual ~ScrollPage() {}

    // EventLoopInput API
    virtual void dispatch(ReplayController&, EventLoopInputDispatcher&) OVERRIDE;

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const OVERRIDE;
    size_t memorySize() const OVERRIDE { return sizeof(ScrollPage); }

    bool isLogicalScroll() const { return m_isLogicalScroll; }
    ScrollDirection scrollDirection() const { ASSERT(!isLogicalScroll()); return m_direction.normal; }
    ScrollLogicalDirection logicalScrollDirection() const { ASSERT(isLogicalScroll()); return m_direction.logical; }
    ScrollGranularity scrollGranularity() const { return m_granularity; }

    static String scrollDirectionToString(ScrollDirection);
    static String logicalScrollDirectionToString(ScrollLogicalDirection);
    static String scrollGranularityToString(ScrollGranularity);

private:
    bool m_isLogicalScroll;
    union {
        ScrollDirection normal;
        ScrollLogicalDirection logical;
    } m_direction;
    ScrollGranularity m_granularity;
};

template<> struct InputCoder<ScrollPage> {
    static void encode(InputEncoder& encoder, const ScrollPage& input);
    static bool decode(InputDecoder& decoder, OwnPtr<ScrollPage>& input);
};

} //namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // ScrollPage_h
