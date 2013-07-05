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

#include "config.h"
#include "InspectorProbeAgent.h"

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "DataProbe.h"
#include "InspectorState.h"
#include "InstrumentingAgents.h"

#if ENABLE(JAVASCRIPT_DEBUGGER)
#include "Page.h"
#include "PageScriptDebugServer.h"
#include "ScriptProbe.h"
#include "ScriptProbeServer.h"
#endif

using namespace WTF;

namespace WebCore {

namespace ProbeAgentState {
static const char probesEnabled[] = "probesEnabled";
}

namespace ProbeTypes {
// Keep this in sync with ProbeAgent.js and DataProbeType in inspector.json
static const char ScriptProbe[] = "script";
}

static ScriptProbeServer* probeServer()
{
    return PageScriptDebugServer::shared().probeServer();
}

#if ENABLE(JAVASCRIPT_DEBUGGER)
PassOwnPtr<ScriptProbeResolver> ScriptProbeResolver::create(Page* page)
{
    return adoptPtr(new ScriptProbeResolver(page));
}

ScriptProbeResolver::ScriptProbeResolver(Page* page)
: m_page(page)
{
    PageScriptDebugServer::shared().addListener(this, m_page);
}

ScriptProbeResolver::~ScriptProbeResolver()
{
    clearProbes();
    PageScriptDebugServer::shared().removeListener(this, m_page);
}

void ScriptProbeResolver::clearScriptMapping()
{
    for (UrlToScriptIdMap::iterator it = m_urlToScriptIdMap.begin(); it != m_urlToScriptIdMap.end(); ++it) {
        probeServer()->clearProbesForScriptId(it->value);
    }

    m_urlToScriptIdMap.clear();
}

void ScriptProbeResolver::clearProbes()
{
    // remove any probes that may be installed the server
    clearScriptMapping();
    m_probes.clear();
}

void ScriptProbeResolver::addProbe(PassRefPtr<ScriptProbe> probe)
{
    m_probes.add(probe);

    // if probe matches url with known script id, resolve immediately.
    UrlToScriptIdMap::const_iterator findResult = m_urlToScriptIdMap.find(probe->url());
    if (findResult == m_urlToScriptIdMap.end())
        return;

    probeServer()->addProbeForScriptId(findResult->value, probe);
}

void ScriptProbeResolver::didParseSource(const String& stringId, const Script& script)
{
    intptr_t scriptId = stringId.toInt();
    UrlToScriptIdMap::AddResult result = m_urlToScriptIdMap.add(script.url, scriptId);
    if (!result.isNewEntry)
        return;

    // find any probes that should resolve within that file, add them.
    for (ProbeSet::const_iterator it = m_probes.begin(); it != m_probes.end(); ++it) {
        if ((*it)->url() == script.url)
            probeServer()->addProbeForScriptId(scriptId, *it);
    }
}

void ScriptProbeResolver::failedToParseSource(const String&, const String&, int, int, const String&)
{
}

void ScriptProbeResolver::didPause(ScriptState*, const ScriptValue&, const ScriptValue&)
{
}

void ScriptProbeResolver::didContinue()
{
}

void ScriptProbeResolver::addScriptProbeSample(int probeId, ScriptState*, const ScriptValue&)
{
    // FIXME: implement some sort of storage
    UNUSED_PARAM(probeId);
}
#endif

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents, state)
, m_nextUID(1)
, m_instrumentingAgents(instrumentingAgents)
, m_inspectedPage(inspectedPage) {}

InspectorProbeAgent::~InspectorProbeAgent()
{
    m_instrumentingAgents->setInspectorProbeAgent(0);
    m_instrumentingAgents = 0;
    m_inspectedPage = 0;
}

void InspectorProbeAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->probe();
    if (m_state->getBoolean(ProbeAgentState::probesEnabled)) {
        ErrorString error;
        enable(&error);
    }
}

// ProbeCommandHandler API
void InspectorProbeAgent::clearFrontend()
{
    m_frontend = 0;
}

void InspectorProbeAgent::enable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, true);
}

void InspectorProbeAgent::disable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, false);
}

void InspectorProbeAgent::isEnabled(ErrorString*, bool* out_state)
{
   *out_state = m_state->getBoolean(ProbeAgentState::probesEnabled);
}

void InspectorProbeAgent::clearAllProbes(ErrorString*)
{
#if ENABLE(JAVASCRIPT_DEBUGGER)
    m_scriptProbeResolver->clearProbes();
#endif

    m_probeMap.clear();
}

void InspectorProbeAgent::getAllProbes(ErrorString*, RefPtr<TypeBuilder::Array<int> >& result)
{
    result = TypeBuilder::Array<int>::create();
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it) {
        result->addItem(it->key);
    }
}

void InspectorProbeAgent::getProbeDetails(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Probe::DataProbe>& result)
{
    ProbeMap::iterator it = m_probeMap.find(uid);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified uid";
        return;
    }

    // FIXME: get samples/metadata from the probe
    result = TypeBuilder::Probe::DataProbe::create()
                .setUid(uid)
                .setType(ProbeTypes::ScriptProbe)
                .setIsEnabled(false);
    //          .setMetadata(XXX)
    //          .setSamples(XXX)
}

void InspectorProbeAgent::enableProbe(ErrorString* errorString, int uid)
{
    ProbeMap::iterator it = m_probeMap.find(uid);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified uid";
        return;
    }

    it->value->enable();
}

void InspectorProbeAgent::disableProbe(ErrorString* errorString, int uid)
{
    ProbeMap::iterator it = m_probeMap.find(uid);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified uid";
        return;
    }

    it->value->disable();
}

void InspectorProbeAgent::createScriptProbe(ErrorString* errorString, const String& url, int lineNumber, int columnNumber, const String& expression)
{
#if ENABLE(JAVASCRIPT_DEBUGGER)
    RefPtr<ScriptProbe> probe = ScriptProbe::create(m_nextUID++, url, lineNumber, columnNumber, expression);
    ProbeMap::AddResult result = m_probeMap.add(probe->uid(), probe);
    ASSERT_UNUSED(result, result.isNewEntry);
    m_scriptProbeResolver->addProbe(probe);
    UNUSED_PARAM(errorString);
#else
    UNUSED_PARAM(url);
    UNUSED_PARAM(lineNumber);
    UNUSED_PARAM(columnNumber);
    UNUSED_PARAM(expression);
    *errorString = "Can't create script probe because JavaScript debugging support is unavailable.";
#endif
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
