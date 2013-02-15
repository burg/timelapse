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

#include "GetDocumentCookie.h"

#include <wtf/text/StringConcatenate.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace JSC {

namespace ReplayableTypes {
const char *GetDocumentCookie = "GetDocumentCookie";
}

GetDocumentCookie::GetDocumentCookie(String cookie, int exceptionCode)
    : ReplayableAction(ReplayableTypes::GetDocumentCookie)
    , m_cookie(cookie)
    , m_exceptionCode(exceptionCode) {}

GetDocumentCookie::~GetDocumentCookie() {}

String GetDocumentCookie::toString() const {
    return makeString("GetDocumentCookie(ec=", String::number(m_exceptionCode), "document.cookie=", m_cookie, ")");
}

size_t GetDocumentCookie::memorySize() const
{
    size_t size = sizeof(GetDocumentCookie);
    size += (!m_cookie.isEmpty()) ? m_cookie.impl()->cost() : 0;
    return size;
}

void GetDocumentCookie::serialize(ActionSerializer* serializer) const
{
    serializer->putInt("exceptionCode", m_exceptionCode);
    serializer->putString("cookie", m_cookie);
}

} //namespace JSC

#endif // ENABLE(TIMELAPSE)
