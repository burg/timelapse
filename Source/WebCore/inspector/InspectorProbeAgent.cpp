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

#if ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)

#include "InjectedScript.h"
#include "InjectedScriptManager.h"
#include "InspectorState.h"
#include "InstrumentingAgents.h"
#include "Page.h"
#include "PageScriptDebugServer.h"
#include "ScriptProbe.h"
#include <wtf/text/StringConcatenate.h>
#include <inttypes.h>

using namespace WTF;

namespace WebCore {

namespace ProbeAgentState {
static const char probesEnabled[] = "probesEnabled";
}

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage, InjectedScriptManager* injectedScriptManager)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents, state)
, m_nextProbeId(1)
, m_nextSampleId(1)
, m_instrumentingAgents(instrumentingAgents)
, m_frontend(0)
, m_inspectedPage(inspectedPage)
, m_injectedScriptManager(injectedScriptManager)
, m_probeMap(ProbeMap())
, m_urlToScriptIdMap(UrlToScriptIdMap()) {}

InspectorProbeAgent::~InspectorProbeAgent()
{
    ASSERT(!m_instrumentingAgents->inspectorProbeAgent());
}

String InspectorProbeAgent::objectGroupForProbeId(int probeId) const
{
    DEFINE_STATIC_LOCAL(const AtomicString, objectGroup, ("script-probe-group-", AtomicString::ConstructFromLiteral));
    return makeString(objectGroup, String::number(probeId));
}

void InspectorProbeAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->probe();
}

void InspectorProbeAgent::clearFrontend()
{
    m_frontend = 0;

    if (!enabled())
        return;

    disable();
    m_state->setBoolean(ProbeAgentState::probesEnabled, false);
}

void InspectorProbeAgent::clearResources()
{
    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it)
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));
}

void InspectorProbeAgent::enable()
{
    m_instrumentingAgents->setInspectorProbeAgent(this);

    PageScriptDebugServer::shared().setProbesActivated(true);
    PageScriptDebugServer::shared().addListener(this, m_inspectedPage);
}

void InspectorProbeAgent::disable()
{
    for (UrlToScriptIdMap::iterator it = m_urlToScriptIdMap.begin(); it != m_urlToScriptIdMap.end(); ++it)
        PageScriptDebugServer::shared().clearProbesForScriptId(it->value);

    m_urlToScriptIdMap.clear();

    PageScriptDebugServer::shared().removeListener(this, m_inspectedPage);
    m_instrumentingAgents->setInspectorProbeAgent(0);

    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it)
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));

    m_probeMap.clear();
}

bool InspectorProbeAgent::enabled()
{
    return m_state->getBoolean(ProbeAgentState::probesEnabled);
}

// ProbeCommandHandler API

void InspectorProbeAgent::captureProbeSample(ScriptState*, PassRefPtr<ScriptProbe> prpProbe, int batchId, const ScriptValue& sample)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    int sampleId = m_nextSampleId++;

    // TODO: (Issue #316): Implement some sort of storage for probe samples.
    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    RefPtr<TypeBuilder::Runtime::RemoteObject> payload = injectedScript.wrapObject(sample, objectGroupForProbeId(probe->uid()));
    RefPtr<TypeBuilder::Probe::ScriptProbeSample> result = TypeBuilder::Probe::ScriptProbeSample::create()
                                                            .setProbeId(probe->uid())
                                                            .setSampleId(sampleId)
                                                            .setBatchId(batchId)
                                                            .setTimestamp(WTF::currentTimeMS())
                                                            .setPayload(payload.release());

    if (m_frontend)
        m_frontend->probeSampleReceived(result.release());
}

void InspectorProbeAgent::enable(ErrorString*)
{
    if (enabled())
        return;

    enable();
    m_state->setBoolean(ProbeAgentState::probesEnabled, true);
}

void InspectorProbeAgent::disable(ErrorString*)
{
    if (!enabled())
        return;

    disable();
    m_state->setBoolean(ProbeAgentState::probesEnabled, false);
}

void InspectorProbeAgent::setProbesActive(ErrorString*, bool state)
{
    PageScriptDebugServer::shared().setProbesActivated(state);
}

void InspectorProbeAgent::getAvailableProbes(ErrorString*, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe> >& resultArray)
{
    resultArray = TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe>::create();
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it) {
        RefPtr<TypeBuilder::Probe::ScriptProbe> probeObject = TypeBuilder::Probe::ScriptProbe::create()
                                                               .setProbeId(it->key)
                                                               .setLineNumber(it->value->position().m_line.zeroBasedInt())
                                                               .setColumnNumber(it->value->position().m_column.zeroBasedInt())
                                                               .setExpression(it->value->expression())
                                                               .setIsEnabled(false);
        probeObject->setUrl(it->value->url());
        resultArray->addItem(probeObject.release());
    }
}

void InspectorProbeAgent::getProbeSamples(ErrorString* errorString, int probeId, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbeSample> >& result)
{
    ProbeMap::iterator it = m_probeMap.find(probeId);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    result = TypeBuilder::Array<TypeBuilder::Probe::ScriptProbeSample>::create();
    // TODO: (Issue #316): Iterate through sample storage, create inspector objects for each sample.
}

void InspectorProbeAgent::removeProbe(ErrorString* errorString, int probeId)
{
    if (!enabled()) {
        *errorString = "Can't clear script probes because Probe agent is not enabled.";
        return;
    }

    ProbeMap::iterator findProbeResult = m_probeMap.find(probeId);
    if (findProbeResult == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    RefPtr<ScriptProbe> probe = findProbeResult->value;
    m_probeMap.remove(findProbeResult);
    if (m_frontend)
        m_frontend->probeRemoved(probeId);

    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    injectedScript.releaseObjectGroup(objectGroupForProbeId(probe->uid()));

    UrlToScriptIdMap::iterator findScriptIdResult = m_urlToScriptIdMap.find(probe->url());
    if (findScriptIdResult == m_urlToScriptIdMap.end())
        return;

    ScriptId scriptId = findScriptIdResult->value;
    PageScriptDebugServer::shared().removeProbeForScriptId(scriptId, probe);
}

void InspectorProbeAgent::enableProbe(ErrorString* errorString, int probeId)
{
    ProbeMap::iterator it = m_probeMap.find(probeId);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    it->value->enable();
    if (m_frontend)
        m_frontend->probeEnabled(probeId);
}

void InspectorProbeAgent::disableProbe(ErrorString* errorString, int probeId)
{
    ProbeMap::iterator it = m_probeMap.find(probeId);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    it->value->disable();
    if (m_frontend)
        m_frontend->probeDisabled(probeId);
}

void InspectorProbeAgent::createScriptProbe(ErrorString* errorString, const String& url, int lineNumber, int columnNumber, const String& expression)
{
    if (!enabled()) {
        *errorString = "Can't create script probe because Probe agent is not enabled.";
        return;
    }

    if (expression.length() == 0) {
        *errorString = "Cannot create a probe with a zero-length expression.";
        return;
    }
    const String& nonNullUrl = (url.isNull()) ? emptyString() : url;
    TextPosition position(OrdinalNumber::fromZeroBasedInt(lineNumber), OrdinalNumber::fromZeroBasedInt(columnNumber));
    RefPtr<ScriptProbe> probe = ScriptProbe::create(m_nextProbeId++, nonNullUrl, position, expression);
    ProbeMap::AddResult result = m_probeMap.add(probe->uid(), probe);
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontend) {
        RefPtr<TypeBuilder::Probe::ScriptProbe> probeObject = TypeBuilder::Probe::ScriptProbe::create()
                                                               .setProbeId(probe->uid())
                                                               .setLineNumber(probe->position().m_line.zeroBasedInt())
                                                               .setColumnNumber(probe->position().m_column.zeroBasedInt())
                                                               .setExpression(probe->expression())
                                                               .setIsEnabled(probe->isEnabled());
        probeObject->setUrl(probe->url());
        m_frontend->probeAdded(probeObject.release());
    }

    UrlToScriptIdMap::const_iterator findResult = m_urlToScriptIdMap.find(probe->url());
    if (findResult == m_urlToScriptIdMap.end())
        return;

    // Resolve immediately if we know a ScriptId corresponding to the probe's url.
    PageScriptDebugServer::shared().addProbeForScriptId(findResult->value, probe);

    if (m_frontend)
        m_frontend->probeResolved(probe->uid(), String::number(findResult->value));
}

// ScriptDebugListener API

void InspectorProbeAgent::willParseSource(const Script&)
{
}

void InspectorProbeAgent::didParseSource(const Script& script)
{
    intptr_t scriptId = script.sourceID.toInt();
    const String& nonNullUrl = (script.url.isNull()) ? emptyString() : script.url;
    m_urlToScriptIdMap.set(nonNullUrl, scriptId);

    // Find any probes that should resolve within that file, add them.
    for (ProbeMap::const_iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it) {
        if (it->value->url() != nonNullUrl)
            continue;

        PageScriptDebugServer::shared().addProbeForScriptId(scriptId, it->value);
        if (m_frontend)
            m_frontend->probeResolved(it->value->uid(), script.sourceID);
    }
}

void InspectorProbeAgent::failedToParseSource(const String&, const String&, int, int, const String&)
{
}

void InspectorProbeAgent::didPause(ScriptState*, const ScriptValue&, const ScriptValue&)
{
}

void InspectorProbeAgent::didContinue()
{
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)
