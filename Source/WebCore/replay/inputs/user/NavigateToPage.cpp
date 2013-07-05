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

#if ENABLE(WEB_REPLAY)

#include "NavigateToPage.h"

#include "ReplayController.h"
#include "DocumentLoader.h"
#include "Frame.h"
#include "InputDecoder.h"
#include "InputEncoder.h"
#include "KURL.h"
#include "NavigationScheduler.h"
#include "NetworkProxy.h"
#include "Page.h"
#include "SecurityOrigin.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

NavigateToPage::NavigateToPage(PassRefPtr<SecurityOrigin> securityOrigin, const String& url, const String& referrer)
    : m_securityOrigin(securityOrigin)
    , m_url(url)
    , m_referrer(referrer)
{
    KURL parsedUrl = KURL(ParsedURLString, url);
}

NavigateToPage::~NavigateToPage() {}

PassRefPtr<SecurityOrigin> NavigateToPage::securityOrigin() const
{
    return m_securityOrigin;
}

// EventLoopInput API

void NavigateToPage::dispatch(ReplayController* controller,
                              EventLoopInputDispatcher* dispatcher)
{
    ASSERT(sealed());

    controller->page()->networkProxy()->setExpectsPageLoad(true);

    //schedule async page load (it uses delay 0)
    controller->page()->mainFrame()->navigationScheduler()->scheduleLocationChange(m_securityOrigin.get(), m_url, m_referrer, true, true);
    dispatcher->didDispatch(this);
}

// NondeterministicInput API

const AtomicString& NavigateToPage::type() const
{
    return inputTypes().NavigateToPage;
}

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

void InputCoder<SecurityOrigin>::encode(InputEncoder& encoder, const SecurityOrigin& input)
{
    encoder.put("origin", input.toString());
}

bool InputCoder<SecurityOrigin>::decode(InputDecoder& decoder, RefPtr<SecurityOrigin>& input)
{
    String originString;
    if (!decoder.get("securityOrigin", originString))
        return false;

    input = SecurityOrigin::createFromString(originString);
    return true;
}

void InputCoder<NavigateToPage>::encode(InputEncoder& encoder, const NavigateToPage& input)
{
    InputCoder<SecurityOrigin>::encode(encoder, *input.securityOrigin());
    encoder.put("url", input.url());
    encoder.put("referrer", input.referrer());
}

bool InputCoder<NavigateToPage>::decode(InputDecoder& decoder, OwnPtr<NavigateToPage>& input)
{
    RefPtr<SecurityOrigin> origin;
    if (!InputCoder<SecurityOrigin>::decode(decoder, origin))
        return false;

    String url;
    if (!decoder.get("url", url))
        return false;

    String referrer;
    if (!decoder.get("referrer", referrer))
        return false;

    input = adoptPtr(new NavigateToPage(origin.release(), url, referrer));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
