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

#ifndef NavigateToPage_h
#define NavigateToPage_h

#if ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include "ReplayableTypes.h"

namespace WebCore {

    class DeterminismController;
    class DocumentLoader;
    class SecurityOrigin;

class NavigateToPage : public DispatchableAction { 

public:
    NavigateToPage(PassRefPtr<SecurityOrigin>, const String& url, const String& referrer, unsigned dispatchCount, const PositionMark&);
    virtual ~NavigateToPage() {};

    PassRefPtr<SecurityOrigin> securityOrigin() const;
    const String& url() const { return m_url; }
    const String& referrer() const { return m_referrer; }

    // DispatchableAction API
    virtual void dispatch(DeterminismController*) OVERRIDE;

    // ReplayableAction API
    virtual String toString() const OVERRIDE;
    size_t memorySize() const OVERRIDE;
    void serialize(WTF::ActionSerializer*) const OVERRIDE;

private:
    RefPtr<SecurityOrigin> m_securityOrigin;
    String m_url;
    String m_referrer;
};

} //namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // NavigateToPage_h
