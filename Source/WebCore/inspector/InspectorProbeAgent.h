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

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "InspectorBaseAgent.h"
#include "InspectorFrontend.h"
#include <wtf/HashMap.h>
#include <wtf/HashSet.h>
#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>
#include <wtf/RefPtr.h>
#include <wtf/Vector.h>

#if ENABLE(JAVASCRIPT_DEBUGGER)
#include "ScriptDebugListener.h"
#include "ScriptState.h"
#endif

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

#if ENABLE(JAVASCRIPT_DEBUGGER)
class ScriptArguments;
class ScriptProbe;
class ScriptValue;

// This helper class encapsulates the logic to add/remove probes from the probe
// server's list as scripts are parsed.
class ScriptProbeResolver : public ScriptDebugListener {
    WTF_MAKE_NONCOPYABLE(ScriptProbeResolver);
public:
    static PassOwnPtr<ScriptProbeResolver> create(Page*, InspectorProbeAgent*);
    virtual ~ScriptProbeResolver();

    void clearScriptMapping();
    void clearProbes();
    void addProbe(PassRefPtr<ScriptProbe>);

private:
    ScriptProbeResolver(Page*, InspectorProbeAgent*);

    // ScriptDebugListener API
    virtual void didParseSource(const String& scriptId, const Script&);
    virtual void failedToParseSource(const String& url, const String& data, int firstLine, int errorLine, const String& errorMessage);
    virtual void didPause(ScriptState*, const ScriptValue& callFrames, const ScriptValue& exception);
    virtual void didContinue();
#if ENABLE(JAVASCRIPT_DEBUGGER)
    void addScriptProbeSample(int probeId, ScriptState*, const ScriptValue&);
#endif

    Page* m_page;
    int m_nextSampleId;
    InspectorProbeAgent* m_probeAgent;
    typedef HashSet<RefPtr<ScriptProbe> > ProbeSet;
    ProbeSet m_probes;
    typedef intptr_t ScriptId;
    typedef HashMap<String, ScriptId> UrlToScriptIdMap;
    UrlToScriptIdMap m_urlToScriptIdMap;
};
#endif

class InspectorProbeAgent
: public InspectorBaseAgent<InspectorProbeAgent>
, public InspectorBackendDispatcher::ProbeCommandHandler {
    WTF_MAKE_NONCOPYABLE(InspectorProbeAgent);
public:
    static PassOwnPtr<InspectorProbeAgent> create(InstrumentingAgents* instrumentingAgents, InspectorCompositeState* state, Page* page, InjectedScriptManager* InjectedScriptManager)
    {
        return adoptPtr(new InspectorProbeAgent(instrumentingAgents, state, page, InjectedScriptManager));
    }

    ~InspectorProbeAgent();

    void setFrontend(InspectorFrontend*);
    void clearFrontend();

    // Callbacks from ScriptProbeResolver
    void scriptProbeSampleAdded(int probeId, int sampleId, ScriptState*, const ScriptValue&);
    bool enabled();

    // ProbeCommandHandler API
    virtual void enable(ErrorString*);
    virtual void disable(ErrorString*);
    virtual void isEnabled(ErrorString*, bool* out_state);

    virtual void clearAllProbes(ErrorString*);
    virtual void getAvailableProbes(ErrorString*, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe> >& result);
    virtual void getProbeSamples(ErrorString*, int probeId, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbeSample> >& result);
    virtual void enableProbe(ErrorString*, int probeId);
    virtual void disableProbe(ErrorString*, int probeId);
    // Line and column numbers start counting from 0.
    virtual void createScriptProbe(ErrorString*, const String& url, int lineNumber, int columnNumber, const String& expression);

private:
    InspectorProbeAgent(InstrumentingAgents*, InspectorCompositeState*, Page*, InjectedScriptManager*);
    const AtomicString& objectGroupName() const;

    typedef HashMap<int, RefPtr<ScriptProbe>> ProbeMap;

    int m_nextProbeId;
    InstrumentingAgents *m_instrumentingAgents;
    InspectorFrontend::Probe* m_frontend;
    Page* m_inspectedPage;
    ProbeMap m_probeMap;
    InjectedScriptManager* m_injectedScriptManager;
#if ENABLE(JAVASCRIPT_DEBUGGER)
    OwnPtr<ScriptProbeResolver> m_scriptProbeResolver;
#endif
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
#endif // InspectorProbeAgent_h
