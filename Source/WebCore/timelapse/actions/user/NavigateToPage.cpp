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

#if ENABLE(TIMELAPSE)

#include "NavigateToPage.h"

#include "DeterminismController.h"
#include "DocumentLoader.h"
#include "Frame.h"
#include "KURL.h"
#include "NavigationScheduler.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "SecurityOrigin.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {

NavigateToPage::NavigateToPage(PassRefPtr<SecurityOrigin> securityOrigin, const String& url, const String& referrer, unsigned dispatchCount, const PositionMark& mark)
    : DispatchableAction(ReplayableTypes::NavigateToPage, dispatchCount, mark)
    , m_securityOrigin(securityOrigin)
    , m_url(url)
    , m_referrer(referrer)
{
    KURL parsedUrl = KURL(ParsedURLString, url);
}

PassRefPtr<SecurityOrigin> NavigateToPage::securityOrigin() const
{
    return m_securityOrigin;
}

// DispatchableAction API

void NavigateToPage::dispatch(DeterminismController* controller)
{
    ASSERT(sealed());

    controller->page()->networkProxy()->setExpectsPageLoad(true);

    //schedule async page load (it uses delay 0)
    controller->page()->mainFrame()->navigationScheduler()->scheduleLocationChange(m_securityOrigin.get(), m_url, m_referrer, true, true);
    controller->didDispatch(this);
}

// ReplayableAction API

String NavigateToPage::toString() const
{
    StringBuilder sb;
    sb.append("NavigateToPage(");
    sb.append(makeString("url=", m_url, ";"));
    sb.append(makeString("referrer=", m_referrer, ";"));
    sb.append(makeString("securityOrigin=", m_securityOrigin->toString(), ";"));
    sb.append(")");
    return sb.toString();
}

size_t NavigateToPage::memorySize() const
{
    size_t size = sizeof(NavigateToPage);
    size += (!m_url.isEmpty()) ? m_url.impl()->cost() : 0;
    size += (!m_referrer.isEmpty()) ? m_referrer.impl()->cost() : 0;
    return size;
}

void NavigateToPage::serialize(ActionSerializer* serializer) const
{
    serializer->putString("securityOrigin", m_securityOrigin->toString());
    serializer->putString("url", m_url);
    serializer->putString("referrer", m_referrer);
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
