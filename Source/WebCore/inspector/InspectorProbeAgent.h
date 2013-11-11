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

#ifndef InspectorProbeAgent_h
#define InspectorProbeAgent_h

#if ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)

#include "InspectorBaseAgent.h"
#include "InspectorFrontend.h"
#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>

namespace WebCore {

class Frame;
class InjectedScriptManager;
class InspectorController;
class InspectorProbeAgent;
class InstrumentingAgents;
class Page;

typedef String ErrorString;

class InspectorProbeAgent : public InspectorBaseAgent<InspectorProbeAgent>, public InspectorBackendDispatcher::ProbeCommandHandler {
    WTF_MAKE_NONCOPYABLE(InspectorProbeAgent);
public:
    static PassOwnPtr<InspectorProbeAgent> create(InstrumentingAgents* instrumentingAgents, Page* page, InjectedScriptManager* injectedScriptManager)
    {
        return adoptPtr(new InspectorProbeAgent(instrumentingAgents, page, injectedScriptManager));
    }

    ~InspectorProbeAgent();

    void setFrontend(InspectorFrontend*);
    void clearFrontend();
    // Called when the main frame navigates.
    void clearResources();
    bool enabled() const { return m_enabled; }

    // ProbeCommandHandler API
    virtual void enable(ErrorString*);
    virtual void disable(ErrorString*);

private:
    InspectorProbeAgent(InstrumentingAgents*, Page*, InjectedScriptManager*);
    void enable();
    void disable();

    InstrumentingAgents *m_instrumentingAgents;
    InspectorFrontend::Probe* m_frontend;
    Page* m_inspectedPage;
    InjectedScriptManager* m_injectedScriptManager;

    bool m_enabled;
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)
#endif // InspectorProbeAgent_h
