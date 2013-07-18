/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#ifndef ScriptProbe_h
#define ScriptProbe_h

#if ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)

#include "DataProbe.h"

#include <wtf/text/WTFString.h>

namespace WebCore {

class ScriptProbe : public DataProbe {
public:
    static RefPtr<ScriptProbe> create(unsigned uid, const String& url, int lineNumber, int columnNumber, const String& expression);
    virtual ~ScriptProbe() {}

    // DataProbe interface
    virtual void enable() { setIsEnabled(true); }
    virtual void disable() { setIsEnabled(false); }
    virtual bool isEnabled() const { return m_isEnabled; }

    const String& url() const { return m_url; }
    int lineNumber() const { return m_lineNumber; }
    int columnNumber() const { return m_columnNumber; }
    const String& expression() const { return m_expression; }

protected:

private:
    ScriptProbe(unsigned uid, const String& url, int lineNumber, int columnNumber, const String& expression);
    virtual void setIsEnabled(bool state) { m_isEnabled = state; }

    bool m_isEnabled;
    String m_url;
    int m_lineNumber;
    int m_columnNumber;
    String m_expression;
};

inline RefPtr<ScriptProbe> ScriptProbe::create(unsigned uid, const String& url, int lineNumber, int columnNumber, const String& expression)
{
    return adoptRef(new ScriptProbe(uid, url, lineNumber, columnNumber, expression));
}

inline ScriptProbe::ScriptProbe(unsigned uid, const String& url, int lineNumber, int columnNumber, const String& expression)
: DataProbe(uid)
, m_isEnabled(false)
, m_url(url)
, m_lineNumber(lineNumber)
, m_columnNumber(columnNumber)
, m_expression(expression) {
    ASSERT(!url.isNull());
    ASSERT(expression.length() > 0);
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)

#endif // ScriptProbe_h
