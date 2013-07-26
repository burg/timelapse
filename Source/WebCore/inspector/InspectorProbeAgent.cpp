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

#include "InspectorState.h"
#include "InstrumentingAgents.h"
#include "Logging.h"
#include <inttypes.h>

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

static ScriptProbeServer* probeServer()
{
    return PageScriptDebugServer::shared().probeServer();
}

#if ENABLE(JAVASCRIPT_DEBUGGER)
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
    // Remove any probes that may be installed the server.
    clearScriptMapping();
    m_probes.clear();
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

void ScriptProbeResolver::addScriptProbeSample(int probeId, ScriptState* state, const ScriptValue& value)
{
    // TODO: (Issue #316): Implement some sort of storage for probe samples.
    // TODO: (Issue #317): Send RemoteObject references to the frontend instead of InspectorValues.
    RefPtr<InspectorObject> payload = InspectorObject::create();
    payload->setValue("value", value.toInspectorValue(state));

    RefPtr<TypeBuilder::Probe::ScriptProbeSample> result = TypeBuilder::Probe::ScriptProbeSample::create()
                                                            .setProbeId(probeId)
                                                            .setSampleId(m_nextSampleId++)
                                                            .setTimestamp(WTF::currentTimeMS())
                                                            .setPayload(payload.release());
    m_probeAgent->scriptProbeSampleAdded(result.release());
}
#endif

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents, state)
, m_nextProbeId(1)
, m_instrumentingAgents(instrumentingAgents)
, m_inspectedPage(inspectedPage) {}

InspectorProbeAgent::~InspectorProbeAgent()
{
    ASSERT(!m_instrumentingAgents->inspectorProbeAgent());
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

void InspectorProbeAgent::scriptProbeSampleAdded(PassRefPtr<TypeBuilder::Probe::ScriptProbeSample> sample)
{
    if (m_frontend)
        m_frontend->probeSampleReceived(sample);
}

bool InspectorProbeAgent::enabled()
{
    return m_state->getBoolean(ProbeAgentState::probesEnabled);
}

void InspectorProbeAgent::enable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, true);
    m_instrumentingAgents->setInspectorProbeAgent(this);
#if ENABLE(JAVASCRIPT_DEBUGGER)
    m_scriptProbeResolver = ScriptProbeResolver::create(m_inspectedPage, this);
#endif
}

void InspectorProbeAgent::disable(ErrorString*)
{
    m_state->setBoolean(ProbeAgentState::probesEnabled, false);
    m_instrumentingAgents->setInspectorProbeAgent(0);
    m_scriptProbeResolver = 0;
}

void InspectorProbeAgent::isEnabled(ErrorString*, bool* out_state)
{
   *out_state = enabled();
}

void InspectorProbeAgent::clearAllProbes(ErrorString* errorString)
{
#if ENABLE(JAVASCRIPT_DEBUGGER)
    if (!enabled()) {
        *errorString = "Can't clear script probes because Probe agent is not enabled.";
        return;
    }
    m_scriptProbeResolver->clearProbes();
#endif

    m_probeMap.clear();
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

void InspectorProbeAgent::enableProbe(ErrorString* errorString, int probeId)
{
    ProbeMap::iterator it = m_probeMap.find(probeId);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    it->value->enable();
}

void InspectorProbeAgent::disableProbe(ErrorString* errorString, int probeId)
{
    ProbeMap::iterator it = m_probeMap.find(probeId);
    if (it == m_probeMap.end()) {
        *errorString = "Couldn't find probe with specified probeId";
        return;
    }

    it->value->disable();
}

void InspectorProbeAgent::createScriptProbe(ErrorString* errorString, const String& url, int lineNumber, int columnNumber, const String& expression)
{
    if (!enabled()) {
        *errorString = "Can't create script probe because Probe agent is not enabled.";
        return;
    }

#if ENABLE(JAVASCRIPT_DEBUGGER)
    if (expression.length() == 0) {
        *errorString = "Cannot create a probe with a zero-length expression.";
        return;
    }
    const String& nonNullUrl = (url.isNull()) ? emptyString() : url;
    TextPosition position(OrdinalNumber::fromZeroBasedInt(lineNumber), OrdinalNumber::fromZeroBasedInt(columnNumber));
    RefPtr<ScriptProbe> probe = ScriptProbe::create(m_nextProbeId++, nonNullUrl, position, expression);
    ProbeMap::AddResult result = m_probeMap.add(probe->uid(), probe);
    ASSERT_UNUSED(result, result.isNewEntry);
    m_scriptProbeResolver->addProbe(probe);
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
    probe->enable();
    m_frontend->probeEnabled(probe->uid());

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
