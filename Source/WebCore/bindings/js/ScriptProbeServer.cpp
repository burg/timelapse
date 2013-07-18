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

#include "PageScriptDebugServer.h"
#include "ScriptProbe.h"
#include "ScriptProbeServer.h"
#include "ScriptValue.h"
#include <debugger/DebuggerCallFrame.h>

namespace WebCore {

PassOwnPtr<ScriptProbeServer> ScriptProbeServer::create()
{
    return adoptPtr(new ScriptProbeServer());
}

ScriptProbeServer::ScriptProbeServer()
: m_isActive(true) {}

ScriptProbeServer::~ScriptProbeServer()
{
    ScriptIdToLinesMap::iterator scriptsIt = m_probeRegistry.begin();
    for (; scriptsIt != m_probeRegistry.end(); ++scriptsIt)
        clearProbesForScriptId(scriptsIt->key);

    m_probeRegistry.clear();
}

void ScriptProbeServer::addProbeForScriptId(intptr_t scriptId, PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;

    if (probe->lineNumber() < 0 || probe->columnNumber() < 0)
        return;

    m_probesById.add(probe->uid(), probe);

    // each of these calls will only actually add key/value pairs if they don't already exist.
    ScriptIdToLinesMap::AddResult scriptsMap = m_probeRegistry.add(scriptId, LineToScriptProbeMap());
    LineToScriptProbeMap::AddResult linesMap = scriptsMap.iterator->value.add(probe->lineNumber(), ProbeSet());
    linesMap.iterator->value.add(probe);
}

void ScriptProbeServer::clearProbesForScriptId(intptr_t scriptId)
{
    if (!m_probeRegistry.contains(scriptId))
        return;

    LineToScriptProbeMap linesForScript = m_probeRegistry.take(scriptId);
    LineToScriptProbeMap::iterator lineIterator = linesForScript.begin();
    // clear probe sets for each line, then clear the lines map.
    for (; lineIterator != linesForScript.end(); ++lineIterator) {
        ProbeSet::iterator probeIterator = lineIterator->value.begin();
        for (; probeIterator != lineIterator->value.end(); ++probeIterator) {
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

    JSC::DebuggerCallFrame debuggerCallFrame(exec);
    JSC::JSValue exception;
    JSC::JSValue result = debuggerCallFrame.evaluate(foundProbe->value->expression(), exception);
    if (exception)
        return;

    ScriptValue wrappedResult = ScriptValue(exec->vm(), result);
    PageScriptDebugServer::shared().addScriptProbeSample(probeId, exec, wrappedResult);
}

// callback from ScriptDebugServer
void ScriptProbeServer::atStatement(const JSC::DebuggerCallFrame& debuggerCallFrame, intptr_t scriptId, int lineNumber, int columnNumber)
{
    // much of this code is adapted from ScriptDebugServer::hasBreakpoint()
    if (!m_isActive)
        return;

    ScriptIdToLinesMap::const_iterator entryForScript = m_probeRegistry.find(scriptId);
    if (entryForScript == m_probeRegistry.end())
        return;

    if (lineNumber < 0 || columnNumber < 0)
        return;

    LineToScriptProbeMap::const_iterator entryForLine = entryForScript->value.find(lineNumber + 1);
    if (entryForLine == entryForScript->value.end())
        return;

    const ProbeSet& probes = entryForLine->value;
    ProbeSet::iterator probesIt = probes.begin();
    for (; probesIt != probes.end(); ++probesIt) {
        RefPtr<ScriptProbe> probe = *probesIt;
        int probeLine = probe->lineNumber();
        int probeColumn = probe->columnNumber();

        if ((lineNumber == probeLine && !probeColumn) ||
            (lineNumber == probeLine && columnNumber == probeColumn)) {

            // aoeu: extract to share this code with addSampleFromConsole?
            JSC::JSValue exception;
            JSC::JSValue result = debuggerCallFrame.evaluate(probe->expression(), exception);
            if (exception)
                continue;

            ScriptValue wrappedResult = ScriptValue(debuggerCallFrame.callFrame()->vm(), result);
            PageScriptDebugServer::shared().addScriptProbeSample(probe->uid(), debuggerCallFrame.callFrame(), wrappedResult);
        }
    }
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)
