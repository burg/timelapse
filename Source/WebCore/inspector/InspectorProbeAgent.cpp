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
#include "InstrumentingAgents.h"
#include "MainFrame.h"
#include "Page.h"
#include <wtf/text/StringConcatenate.h>
#include <inttypes.h>

using namespace WTF;

namespace WebCore {

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, Page* inspectedPage, InjectedScriptManager* injectedScriptManager)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents)
, m_instrumentingAgents(instrumentingAgents)
, m_frontend(nullptr)
, m_inspectedPage(inspectedPage)
, m_injectedScriptManager(injectedScriptManager)
, m_enabled(false) {}

InspectorProbeAgent::~InspectorProbeAgent()
{
    ASSERT(!m_instrumentingAgents->inspectorProbeAgent());
}

/*
static String objectGroupForProbeId(int probeId) const
{
    DEFINE_STATIC_LOCAL(const AtomicString, objectGroup, ("script-probe-group-", AtomicString::ConstructFromLiteral));
    return makeString(objectGroup, String::number(probeId));
}
*/

void InspectorProbeAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->probe();
}

void InspectorProbeAgent::clearFrontend()
{
    m_frontend = nullptr;

    if (!enabled())
        return;

    disable();
}

void InspectorProbeAgent::clearResources()
{
    ScriptState* state = mainWorldExecState(&m_inspectedPage->mainFrame());
    m_injectedScriptManager->injectedScriptFor(state);
    /*
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it)
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));
    */
}

void InspectorProbeAgent::enable()
{
    m_instrumentingAgents->setInspectorProbeAgent(this);
    m_enabled = true;
    // PageScriptDebugServer::shared().addListener(this, m_inspectedPage);
}

void InspectorProbeAgent::disable()
{
    m_instrumentingAgents->setInspectorProbeAgent(nullptr);
    m_enabled = false;
    /*
    PageScriptDebugServer::shared().removeListener(this, m_inspectedPage);
    ScriptState* state = mainWorldExecState(&m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    for (ProbeMap::iterator it = m_probeMap.begin(); it != m_probeMap.end(); ++it)
        injectedScript.releaseObjectGroup(objectGroupForProbeId(it->key));
    */
}

/*
void InspectorProbeAgent::captureProbeSample(ScriptState*, PassRefPtr<ScriptProbe> prpProbe, int batchId, const ScriptValue& sample)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    int sampleId = m_nextSampleId++;

    // TODO: (Issue #316): Implement some sort of storage for probe samples.
    ScriptState* state = mainWorldExecState(&m_inspectedPage->mainFrame());
    InjectedScript injectedScript = m_injectedScriptManager->injectedScriptFor(state);
    RefPtr<TypeBuilder::Runtime::RemoteObject> payload = injectedScript.wrapObject(sample, objectGroupForProbeId(probe->uid()));
    RefPtr<TypeBuilder::Probe::ScriptProbeSample> result = TypeBuilder::Probe::ScriptProbeSample::create()
                                                            .setSampleId(sampleId)
                                                            .setBatchId(batchId)
                                                            .setTimestamp(WTF::currentTimeMS())
                                                            .setPayload(payload.release());

    if (m_frontend)
        m_frontend->probeSampleReceived(result.release());
}
*/

void InspectorProbeAgent::enable(ErrorString*)
{
    if (enabled())
        return;

    enable();
}

void InspectorProbeAgent::disable(ErrorString*)
{
    if (!enabled())
        return;

    disable();
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(JAVASCRIPT_DEBUGGER)
