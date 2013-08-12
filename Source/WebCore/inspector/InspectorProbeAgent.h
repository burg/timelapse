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
#include "ScriptDebugListener.h"
#include "ScriptState.h"
#include <wtf/HashMap.h>
#include <wtf/HashSet.h>
#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>
#include <wtf/RefPtr.h>
#include <wtf/Vector.h>

namespace WebCore {

class Frame;
class InjectedScriptManager;
class InspectorController;
class InspectorCompositeState;
class InspectorProbeAgent;
class InstrumentingAgents;
class Page;
class ScriptProbe;

typedef String ErrorString;

class ScriptArguments;
class ScriptValue;

class InspectorProbeAgent
: public InspectorBaseAgent<InspectorProbeAgent>
, public ScriptDebugListener
, public InspectorBackendDispatcher::ProbeCommandHandler {
    friend class ScriptProbeResolver;

    WTF_MAKE_NONCOPYABLE(InspectorProbeAgent);
public:
    static PassOwnPtr<InspectorProbeAgent> create(InstrumentingAgents* instrumentingAgents, InspectorCompositeState* state, Page* page, InjectedScriptManager* InjectedScriptManager)
    {
        return adoptPtr(new InspectorProbeAgent(instrumentingAgents, state, page, InjectedScriptManager));
    }

    ~InspectorProbeAgent();

    void setFrontend(InspectorFrontend*);
    void clearFrontend();

    // ProbeCommandHandler API
    virtual void enable(ErrorString*);
    virtual void disable(ErrorString*);
    virtual void setProbesActive(ErrorString*, bool active);

    virtual void getAvailableProbes(ErrorString*, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe> >& result);
    virtual void getProbeSamples(ErrorString*, int probeId, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbeSample> >& result);
    virtual void removeProbe(ErrorString*, int probeId);
    virtual void enableProbe(ErrorString*, int probeId);
    virtual void disableProbe(ErrorString*, int probeId);
    // Line and column numbers start counting from 0.
    virtual void createScriptProbe(ErrorString*, const String& url, int lineNumber, int columnNumber, const String& expression);

    // ScriptDebugListener API
    virtual void didParseSource(const String& scriptId, const Script&);
    virtual void failedToParseSource(const String& url, const String& data, int firstLine, int errorLine, const String& errorMessage);
    virtual void didPause(ScriptState*, const ScriptValue& callFrames, const ScriptValue& exception);
    virtual void didContinue();
    virtual void captureProbeSample(ScriptState*, PassRefPtr<ScriptProbe>, int batchId, const ScriptValue&);

private:
    InspectorProbeAgent(InstrumentingAgents*, InspectorCompositeState*, Page*, InjectedScriptManager*);
    String objectGroupForProbeId(int probeId) const;
    bool enabled();
    void enable();
    void disable();

    typedef HashMap<int, RefPtr<ScriptProbe>> ProbeMap;
    typedef HashSet<RefPtr<ScriptProbe> > ProbeSet;
    typedef intptr_t ScriptId;
    typedef HashMap<String, ScriptId> UrlToScriptIdMap;

    int m_nextProbeId;
    int m_nextSampleId;

    InstrumentingAgents *m_instrumentingAgents;
    InspectorFrontend::Probe* m_frontend;
    Page* m_inspectedPage;
    InjectedScriptManager* m_injectedScriptManager;

    ProbeMap m_probeMap;
    UrlToScriptIdMap m_urlToScriptIdMap;
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)
#endif // InspectorProbeAgent_h
