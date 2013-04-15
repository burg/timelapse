/*
 *  Copyright (C) 2011-2013, Brian Burg.
 *  Copyright (C) 2011-2013, University of Washington. All rights reserved.
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

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "DataProbe.h"
#include "InspectorState.h"
#include "InstrumentingAgents.h"

using namespace WTF;

namespace WebCore {

namespace ProbeAgentState {
static const char probesEnabled[] = "probesEnabled";
}

namespace ProbeTypes {
// Keep this in sync with ProbeAgent.js and DataProbeType in inspector.json
static const char ScriptProbe[] = "script";
}

InspectorProbeAgent::InspectorProbeAgent(InstrumentingAgents* instrumentingAgents, InspectorCompositeState *state, Page* inspectedPage)
: InspectorBaseAgent<InspectorProbeAgent>("Probe", instrumentingAgents, state)
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
    m_frontend = frontend->replay();
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
    // TODO: tell script probe server to destroy all probes
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
    
    // TODO: implement, getting samples/metadata from the probe
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

void InspectorProbeAgent::createScriptProbe(ErrorString*, const String& url, int lineNumber, int columnNumber, const String& expression)
{
    // TODO: implement
    UNUSED_PARAM(url);
    UNUSED_PARAM(lineNumber);
    UNUSED_PARAM(columnNumber);
    UNUSED_PARAM(expression);
}


}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
