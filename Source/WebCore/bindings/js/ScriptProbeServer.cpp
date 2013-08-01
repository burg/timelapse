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

#if ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)

#include "ScriptProbeServer.h"

#include "Logging.h"
#include "PageScriptDebugServer.h"
#include "ScriptProbe.h"
#include "ScriptValue.h"
#include <debugger/DebuggerCallFrame.h>

namespace WebCore {

PassOwnPtr<ScriptProbeServer> ScriptProbeServer::create()
{
    return adoptPtr(new ScriptProbeServer());
}

ScriptProbeServer::ScriptProbeServer()
: m_isActive(true)
, m_nextBatchId(1) {}

ScriptProbeServer::~ScriptProbeServer()
{
    ScriptIdToLinesMap::iterator scriptsIt = m_probeRegistry.begin();
    for (; scriptsIt != m_probeRegistry.end(); ++scriptsIt)
        clearProbesForScriptId(scriptsIt->key);

    m_probeRegistry.clear();
}

void ScriptProbeServer::addProbeForScriptId(ScriptId scriptId, PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;

    LOG(DeterministicReplay, "ScriptProbeServer: added probe uid=%d (script id=%" PRIiPTR ", url=%s, line=%d, col=%d)", probe->uid(), scriptId, probe->url().utf8().data(), probe->position().m_line.zeroBasedInt(), probe->position().m_column.zeroBasedInt());

    m_probesById.add(probe->uid(), probe);

    // Each of these calls will only actually add key/value pairs if they don't already exist.
    ScriptIdToLinesMap::AddResult scriptsMap = m_probeRegistry.add(scriptId, LineToScriptProbeMap());
    LineToScriptProbeMap::AddResult linesMap = scriptsMap.iterator->value.add(probe->position().m_line, ProbeSet());
    linesMap.iterator->value.add(probe);
}

void ScriptProbeServer::removeProbeForScriptId(ScriptId scriptId, PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;

    ProbeMap::iterator foundProbe = m_probesById.find(probe->uid());
    if (foundProbe == m_probesById.end())
        return;
    m_probesById.remove(foundProbe);

    ScriptIdToLinesMap::iterator linesForScript = m_probeRegistry.find(scriptId);
    if (linesForScript == m_probeRegistry.end())
        return;
    LineToScriptProbeMap::iterator probeSet = linesForScript->value.find(probe->position().m_line);
    if (probeSet == linesForScript->value.end())
        return;
    ProbeSet::iterator probeElement = probeSet->value.find(probe);
    if (probeElement == probeSet->value.end())
        return;
    probeSet->value.remove(probeElement);

    LOG(DeterministicReplay, "ScriptProbeServer: removed probe uid=%d (script id=%" PRIiPTR ", url=%s, line=%d, col=%d)", probe->uid(), scriptId, probe->url().utf8().data(), probe->position().m_line.zeroBasedInt(), probe->position().m_column.zeroBasedInt());
}

void ScriptProbeServer::clearProbesForScriptId(ScriptId scriptId)
{
    if (!m_probeRegistry.contains(scriptId))
        return;

    LineToScriptProbeMap linesForScript = m_probeRegistry.take(scriptId);
    LineToScriptProbeMap::iterator lineIterator = linesForScript.begin();
    // Clear probe sets for each line, then clear the lines map.
    for (; lineIterator != linesForScript.end(); ++lineIterator) {
        ProbeSet::iterator probeIterator = lineIterator->value.begin();
        for (; probeIterator != lineIterator->value.end(); ++probeIterator) {
            LOG(DeterministicReplay, "ScriptProbeServer: cleared probe id=%d (script id=%" PRIiPTR ")", (*probeIterator)->uid(), scriptId);
            m_probesById.remove((*probeIterator)->uid());
        }
        lineIterator->value.clear();
    }

    linesForScript.clear();
}

void ScriptProbeServer::addSampleFromConsole(int probeId, ScriptState* exec)
{
    if (!m_isActive)
        return;

    ProbeMap::const_iterator foundProbe = m_probesById.find(probeId);
    if (foundProbe == m_probesById.end())
        return;

    LOG(DeterministicReplay, "ScriptProbeServer: adding synthetic sample for probe uid=%d", foundProbe->value->uid());

    JSC::DebuggerCallFrame debuggerCallFrame(exec);
    JSC::JSValue exception;
    JSC::JSValue result = debuggerCallFrame.evaluate(foundProbe->value->expression(), exception);
    if (exception)
        return;

    ScriptValue wrappedResult = ScriptValue(exec->vm(), result);
    PageScriptDebugServer::shared().dispatchCaptureProbeSample(exec, foundProbe->value, m_nextBatchId++, wrappedResult);
}

void ScriptProbeServer::atStatement(const JSC::DebuggerCallFrame& debuggerCallFrame, intptr_t scriptId, int lineNumber, int columnNumber)
{
    TextPosition textPosition(OrdinalNumber::fromOneBasedInt(lineNumber), OrdinalNumber::fromOneBasedInt(columnNumber));
    captureSamplesIfNeeded(debuggerCallFrame, scriptId, textPosition);
}

void ScriptProbeServer::captureSamplesIfNeeded(const JSC::DebuggerCallFrame& debuggerCallFrame, ScriptId scriptId, const TextPosition& position)
{
    if (!m_isActive)
        return;

    ProbeSet foundProbes;
    if (!findProbesForPosition(scriptId, position, foundProbes))
        return;

    int batchId = m_nextBatchId++;

    ProbeSet::iterator probesIt = foundProbes.begin();
    for (; probesIt != foundProbes.end(); ++probesIt) {
        RefPtr<ScriptProbe> probe = *probesIt;
        if (!probe->isEnabled())
            continue;

        // TODO: (Issue #315): The column number is not checked here, but should be.
        // See the logic in ScriptDebugServer::hasBreakpoint for an exposition of cases and concerns.
        if (position.m_line == probe->position().m_line) {
            LOG(DeterministicReplay, "ScriptProbeServer: adding sample for probe uid=%d", probe->uid());
            JSC::JSValue exception;
            JSC::JSValue result = debuggerCallFrame.evaluate(probe->expression(), exception);
            // TODO: (Issue #314): Propagate exception to the frontend instead of silently dropping it.
            if (exception)
                continue;

            ScriptValue wrappedResult = ScriptValue(debuggerCallFrame.callFrame()->vm(), result);
            PageScriptDebugServer::shared().dispatchCaptureProbeSample(debuggerCallFrame.callFrame(), probe, batchId, wrappedResult);
        }
    }
}

bool ScriptProbeServer::findProbesForPosition(ScriptId scriptId, const TextPosition& position, ProbeSet& result)
{
    ScriptIdToLinesMap::const_iterator entryForScript = m_probeRegistry.find(scriptId);
    if (entryForScript == m_probeRegistry.end())
        return false;

    LineToScriptProbeMap::const_iterator entryForLine = entryForScript->value.find(position.m_line);
    if (entryForLine == entryForScript->value.end())
        return false;

    LOG(DeterministicReplay, "ScriptProbeServer: maybe adding sample for line+col %d,%d (script id: %" PRIiPTR ")", position.m_line.zeroBasedInt(), position.m_column.zeroBasedInt(), scriptId);

    result = entryForLine->value;
    return true;

}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)
