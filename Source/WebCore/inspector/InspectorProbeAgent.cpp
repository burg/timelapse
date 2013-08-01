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

#include "InjectedScript.h"
#include "InjectedScriptManager.h"
#include "InspectorState.h"
#include "InstrumentingAgents.h"
#include "Logging.h"
#include "Page.h"
#include "PageScriptDebugServer.h"
#include "ScriptProbe.h"
#include "ScriptProbeServer.h"
#include <wtf/text/StringConcatenate.h>
#include <inttypes.h>

using namespace WTF;

namespace WebCore {

namespace ProbeAgentState {
static const char probesEnabled[] = "probesEnabled";
}

static ScriptProbeServer* probeServer()
{
    return PageScriptDebugServer::shared().probeServer();
}

PassOwnPtr<ScriptProbeResolver> ScriptProbeResolver::create(Page* page, InspectorProbeAgent* probeAgent)
{
    return adoptPtr(new ScriptProbeResolver(page, probeAgent));
}

ScriptProbeResolver::ScriptProbeResolver(Page* page, InspectorProbeAgent* probeAgent)
: m_page(page)
, m_nextSampleId(1)
, m_probeAgent(probeAgent)
{
    PageScriptDebugServer::shared().addListener(this, m_page);
}

ScriptProbeResolver::~ScriptProbeResolver()
{
    clearScriptMapping();
    m_probes.clear();
    PageScriptDebugServer::shared().removeListener(this, m_page);
}

void ScriptProbeResolver::clearScriptMapping()
{
    for (UrlToScriptIdMap::iterator it = m_urlToScriptIdMap.begin(); it != m_urlToScriptIdMap.end(); ++it)
        probeServer()->clearProbesForScriptId(it->value);

    m_urlToScriptIdMap.clear();
}

void ScriptProbeResolver::addProbe(PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    m_probes.add(probe);

    LOG(DeterministicReplay, "ScriptProbeResolver::addProbe id=%d, expression=%s", probe->uid(), probe->expression().utf8().data());

    // If probe matches url with known script id, resolve immediately.
    UrlToScriptIdMap::const_iterator findResult = m_urlToScriptIdMap.find(probe->url());
    if (findResult == m_urlToScriptIdMap.end())
        return;

    probeServer()->addProbeForScriptId(findResult->value, probe);
}

void ScriptProbeResolver::removeProbe(PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    UrlToScriptIdMap::iterator findResult = m_urlToScriptIdMap.find(probe->url());
    if (findResult == m_urlToScriptIdMap.end())
        return;

    probeServer()->removeProbeForScriptId(findResult->value, probe);
    m_urlToScriptIdMap.remove(findResult);
}

void ScriptProbeResolver::didParseSource(const String& stringId, const Script& script)
{
    intptr_t scriptId = stringId.toInt();
    const String& nonNullUrl = (script.url.isNull()) ? emptyString() : script.url;
    m_urlToScriptIdMap.add(nonNullUrl, scriptId);

    LOG(DeterministicReplay, "ScriptProbeResolver::didParseSource id=%" PRIiPTR ", url=%s", scriptId, nonNullUrl.utf8().data());

    // Find any probes that should resolve within that file, add them.
    for (ProbeSet::const_iterator it = m_probes.begin(); it != m_probes.end(); ++it) {
        if ((*it)->url() == nonNullUrl)
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

void ScriptProbeResolver::captureProbeSample(ScriptState* state, PassRefPtr<ScriptProbe> prpProbe, int batchId, const ScriptValue& sample)
{
    m_probeAgent->captureProbeSample(state, prpProbe, batchId, m_nextSampleId++, sample);
}

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage, InjectedScriptManager* injectedScriptManager)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents, state)
, m_nextProbeId(1)
, m_instrumentingAgents(instrumentingAgents)
, m_frontend(0)
, m_inspectedPage(inspectedPage)
, m_probeMap(ProbeMap())
, m_injectedScriptManager(injectedScriptManager)
, m_probeResolver(0) {}

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

void InspectorProbeAgent::captureProbeSample(ScriptState* state, PassRefPtr<ScriptProbe> prpProbe, int batchId, int sampleId, const ScriptValue& sample)
{
    RefPtr<ScriptProbe> probe = prpProbe;

    // TODO: (Issue #316): Implement some sort of storage for probe samples.
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

bool InspectorProbeAgent::enabled()
{
    return m_state->getBoolean(ProbeAgentState::probesEnabled);
}

void InspectorProbeAgent::enable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, true);
    m_instrumentingAgents->setInspectorProbeAgent(this);
    m_probeResolver = ScriptProbeResolver::create(m_inspectedPage, this);
}

void InspectorProbeAgent::disable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, false);
    m_instrumentingAgents->setInspectorProbeAgent(0);
    m_probeResolver = 0;

    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it)
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));
}

void InspectorProbeAgent::isEnabled(ErrorString*, bool* out_state)
{
   *out_state = enabled();
}

void InspectorProbeAgent::clearAllProbes(ErrorString*)
{
    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it) {
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));
        m_probeMap.remove(it);
        m_probeResolver->removeProbe(it->value);
    }
}

void InspectorProbeAgent::getAvailableProbes(ErrorString*, RefPtr<TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe> >& resultArray)
{
    resultArray = TypeBuilder::Array<TypeBuilder::Probe::ScriptProbe>::create();
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it) {
        RefPtr<TypeBuilder::Probe::ScriptProbe> probeObject = TypeBuilder::Probe::ScriptProbe::create()
                                                               .setProbeId(it->key)
                                                               .setLineNumber(it->value->position().m_line.zeroBasedInt())
                                                               .setExpression(it->value->expression())
                                                               .setIsEnabled(false);
        probeObject->setUrl(it->value->url());
        probeObject->setColumnNumber(it->value->position().m_column.zeroBasedInt());

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

    ProbeMap::iterator foundProbe = m_probeMap.find(probeId);
    if (foundProbe == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    ScriptState* state = mainWorldScriptState(m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    injectedScript.releaseObjectGroup(objectGroupForProbeId(foundProbe->key));

    // Remove from maps last, because it invalidates the iterator returned by find().
    m_probeResolver->removeProbe(foundProbe->value);
    m_probeMap.remove(foundProbe);

    if (m_frontend)
        m_frontend->probeRemoved(probeId);
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
    m_probeResolver->addProbe(probe);
    if (!m_frontend)
        return;

    RefPtr<TypeBuilder::Probe::ScriptProbe> probeObject = TypeBuilder::Probe::ScriptProbe::create()
                                                           .setProbeId(probe->uid())
                                                           .setLineNumber(probe->position().m_line.zeroBasedInt())
                                                           .setExpression(probe->expression())
                                                           .setIsEnabled(probe->isEnabled());
    probeObject->setUrl(probe->url());
    probeObject->setColumnNumber(probe->position().m_column.zeroBasedInt());

    m_frontend->probeAdded(probeObject.release());
    // Probes are not enabled when they are created, but the backend enables them immediately.
    enableProbe(errorString, probe->uid());
    UNUSED_PARAM(errorString);
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
