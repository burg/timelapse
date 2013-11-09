/*
 * Copyright (C) 2008, 2009, 2013 Apple Inc. All rights reserved.
 * Copyright (C) 2010-2011 Google Inc. All rights reserved.
 * Copyright (C) 2013 University of Washington. All rights reserved.
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
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"

#if ENABLE(JAVASCRIPT_DEBUGGER)

#include "ScriptDebugServer.h"

#include "ContentSearchUtils.h"
#include "Frame.h"
#include "JSDOMWindowCustom.h"
#include "JSJavaScriptCallFrame.h"
#include "JavaScriptCallFrame.h"
#include "PageConsole.h"
#include "ScriptBreakpoint.h"
#include "ScriptDebugListener.h"
#include "ScriptProbe.h"
#include "ScriptValue.h"
#include "Sound.h"
#include <debugger/DebuggerCallFrame.h>
#include <parser/SourceProvider.h>
#include <runtime/JSLock.h>
#include <wtf/MainThread.h>
#include <wtf/TemporaryChange.h>
#include <wtf/text/WTFString.h>

#if ENABLE(WEB_REPLAY)
#include <wtf/replay/InputIterator.h>
#endif

using namespace JSC;

namespace WebCore {

/*
<<<<<<< HEAD
ScriptDebugServer::ScriptDebugServer()
    : m_callingListeners(false)
    , m_pauseOnExceptionsState(DontPauseOnExceptions)
    , m_pauseOnNextStatement(false)
    , m_paused(false)
    , m_runningNestedMessageLoop(false)
    , m_doneProcessingDebuggerEvents(true)
    , m_breakpointsActivated(true)
    , m_probesActivated(true)
    , m_pauseOnCallFrame(0)
    , m_currentCallFrame(0)
    , m_recompileTimer(this, &ScriptDebugServer::recompileAllJSFunctions)
    , m_lastExecutedLine(-1)
    , m_lastExecutedSourceId(-1)
    , m_nextBatchId(1)
=======
*/
ScriptDebugServer::ScriptDebugServer(bool isInWorkerThread)
    : Debugger(isInWorkerThread)
    , m_doneProcessingDebuggerEvents(true)
    , m_callingListeners(false)
    , m_runningNestedMessageLoop(false)
    , m_recompileTimer(this, &ScriptDebugServer::recompileAllJSFunctions)
// >>>>>>> upstream/master
{
//    clearPauseTrigger();
}

ScriptDebugServer::~ScriptDebugServer()
{
/*
    ScriptIdToPositionsMap::iterator scriptsIt = m_probeRegistry.begin();
    for (; scriptsIt != m_probeRegistry.end(); ++scriptsIt)
        clearProbesForScriptId(scriptsIt->key);

    m_probeRegistry.clear();
*/
}

BreakpointID ScriptDebugServer::setBreakpoint(SourceID sourceID, const ScriptBreakpoint& scriptBreakpoint, unsigned* actualLineNumber, unsigned* actualColumnNumber)
{
    if (!sourceID)
        return noBreakpointID;

    JSC::Breakpoint breakpoint(sourceID, scriptBreakpoint.lineNumber, scriptBreakpoint.columnNumber, scriptBreakpoint.condition, scriptBreakpoint.autoContinue);
    BreakpointID id = Debugger::setBreakpoint(breakpoint, *actualLineNumber, *actualColumnNumber);
    if (id != noBreakpointID && !scriptBreakpoint.actions.isEmpty()) {
#ifndef NDEBUG
        BreakpointIDToActionsMap::iterator it = m_breakpointIDToActions.find(id);
        ASSERT(it == m_breakpointIDToActions.end());
#endif
        const Vector<ScriptBreakpointAction> &actions = scriptBreakpoint.actions;
        m_breakpointIDToActions.set(id, actions);
    }
    return id;
}

void ScriptDebugServer::removeBreakpoint(BreakpointID id)
{
    ASSERT(id != noBreakpointID);
    BreakpointIDToActionsMap::iterator it = m_breakpointIDToActions.find(id);
    if (it != m_breakpointIDToActions.end())
        m_breakpointIDToActions.remove(it);

    Debugger::removeBreakpoint(id);
}

bool ScriptDebugServer::evaluateBreakpointAction(const ScriptBreakpointAction& breakpointAction) const
{
    DebuggerCallFrame* debuggerCallFrame = currentDebuggerCallFrame();
    switch (breakpointAction.type) {
    case ScriptBreakpointActionTypeLog: {
        DOMWindow& window = asJSDOMWindow(debuggerCallFrame->dynamicGlobalObject())->impl();
        if (PageConsole* console = window.pageConsole())
            console->addMessage(JSMessageSource, LogMessageLevel, breakpointAction.data);
        break;
    }
    case ScriptBreakpointActionTypeEvaluate: {
        JSValue exception;
        debuggerCallFrame->evaluate(breakpointAction.data, exception);
        if (exception)
            reportException(debuggerCallFrame->exec(), exception);
        break;
    }
    case ScriptBreakpointActionTypeSound:
        systemBeep();
        break;
    }

    return true;
}

void ScriptDebugServer::clearBreakpoints()
{
    Debugger::clearBreakpoints();
    m_breakpointIDToActions.clear();
}
/*
<<<<<<< HEAD

void ScriptDebugServer::setProbesActivated(bool activated)
{
    m_probesActivated = activated;
}

void ScriptDebugServer::addProbeForScriptId(ScriptId scriptId, PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    m_probesById.add(probe->uid(), probe);

    // Each of these calls will only actually add key/value pairs if they don't already exist.
    ScriptIdToPositionsMap::AddResult scriptsMap = m_probeRegistry.add(scriptId, PositionToScriptProbeSet());
    PositionToScriptProbeSet::AddResult positionsMap = scriptsMap.iterator->value.add(probe->position(), ProbeSet());
    positionsMap.iterator->value.add(probe);
}

void ScriptDebugServer::removeProbeForScriptId(ScriptId scriptId, PassRefPtr<ScriptProbe> prpProbe)
{
    RefPtr<ScriptProbe> probe = prpProbe;

    ProbeMap::iterator foundProbe = m_probesById.find(probe->uid());
    if (foundProbe == m_probesById.end())
        return;
    m_probesById.remove(foundProbe);

    ScriptIdToPositionsMap::iterator positionsForScript = m_probeRegistry.find(scriptId);
    if (positionsForScript == m_probeRegistry.end())
        return;

    PositionToScriptProbeSet::iterator probeSet = positionsForScript->value.find(probe->position());
    if (probeSet == positionsForScript->value.end())
        return;

    ProbeSet::iterator probeElement = probeSet->value.find(probe);
    if (probeElement == probeSet->value.end())
        return;

    probeSet->value.remove(probeElement);
}

void ScriptDebugServer::clearProbesForScriptId(ScriptId scriptId)
{
    if (!m_probeRegistry.contains(scriptId))
        return;

    PositionToScriptProbeSet positionsForScript = m_probeRegistry.take(scriptId);
    PositionToScriptProbeSet::iterator positionIterator = positionsForScript.begin();
    // Clear probe sets for each line, then clear the lines map.
    for (; positionIterator != positionsForScript.end(); ++positionIterator) {
        ProbeSet::iterator probeIterator = positionIterator->value.begin();
        for (; probeIterator != positionIterator->value.end(); ++probeIterator)
            m_probesById.remove((*probeIterator)->uid());

        positionIterator->value.clear();
    }

    positionsForScript.clear();
}
=======
*/

bool ScriptDebugServer::canSetScriptSource()
{
    return false;
}

bool ScriptDebugServer::setScriptSource(const String&, const String&, bool, String*, ScriptValue*, ScriptObject*)
{
    // FIXME(40300): implement this.
    return false;
}


void ScriptDebugServer::updateCallStack(ScriptValue*)
{
    // This method is used for restart frame feature that is not implemented yet.
    // FIXME(40300): implement this.
}

void ScriptDebugServer::dispatchDidPause(ScriptDebugListener* listener)
{
    ASSERT(isPaused());
    DebuggerCallFrame* debuggerCallFrame = currentDebuggerCallFrame();
    JSGlobalObject* globalObject = debuggerCallFrame->scope()->globalObject();
    JSC::ExecState* state = globalObject->globalExec();
    RefPtr<JavaScriptCallFrame> javaScriptCallFrame = JavaScriptCallFrame::create(debuggerCallFrame);
    JSValue jsCallFrame;
    {
        if (globalObject->inherits(JSDOMGlobalObject::info())) {
            JSDOMGlobalObject* domGlobalObject = jsCast<JSDOMGlobalObject*>(globalObject);
            JSLockHolder lock(state);
            jsCallFrame = toJS(state, domGlobalObject, javaScriptCallFrame.get());
        } else
            jsCallFrame = jsUndefined();
    }
    listener->didPause(state, ScriptValue(state->vm(), jsCallFrame), ScriptValue());
}

void ScriptDebugServer::dispatchDidContinue(ScriptDebugListener* listener)
{
    listener->didContinue();
}

void ScriptDebugServer::dispatchDidParseSource(const ListenerSet& listeners, SourceProvider* sourceProvider, bool isContentScript)
{
    SourceID sourceID = sourceProvider->asID();

    ScriptDebugListener::Script script;
    script.url = sourceProvider->url();
    script.source = sourceProvider->source();
    script.startLine = sourceProvider->startPosition().m_line.zeroBasedInt();
    script.startColumn = sourceProvider->startPosition().m_column.zeroBasedInt();
    script.isContentScript = isContentScript;

    int sourceLength = script.source.length();
    int lineCount = 1;
    int lastLineStart = 0;
    for (int i = 0; i < sourceLength; ++i) {
        if (script.source[i] == '\n') {
            lineCount += 1;
            lastLineStart = i + 1;
        }
    }

    script.endLine = script.startLine + lineCount - 1;
    if (lineCount == 1)
        script.endColumn = script.startColumn + sourceLength;
    else
        script.endColumn = sourceLength - lastLineStart;

    Vector<ScriptDebugListener*> copy;
    copyToVector(listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->didParseSource(sourceID, script);
}

void ScriptDebugServer::dispatchFailedToParseSource(const ListenerSet& listeners, SourceProvider* sourceProvider, int errorLine, const String& errorMessage)
{
    String url = sourceProvider->url();
    const String& data = sourceProvider->source();
    int firstLine = sourceProvider->startPosition().m_line.oneBasedInt();

    Vector<ScriptDebugListener*> copy;
    copyToVector(listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->failedToParseSource(url, data, firstLine, errorLine, errorMessage);
}

/*
void ScriptDebugServer::dispatchCaptureProbeSample(ScriptState* exec, PassRefPtr<ScriptProbe> prpProbe, int batchId, const ScriptValue& sample)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    ListenerSet* listeners = getListenersForGlobalObject(exec->dynamicGlobalObject());
    Vector<ScriptDebugListener*> copy;
    copyToVector(*listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->captureProbeSample(exec, probe, batchId, sample);
}
*/

bool ScriptDebugServer::isContentScript(ExecState* exec)
{
    return &currentWorld(exec) != &mainThreadNormalWorld();
}

void ScriptDebugServer::sourceParsed(ExecState* exec, SourceProvider* sourceProvider, int errorLine, const String& errorMessage)
{
    if (m_callingListeners)
        return;

    ListenerSet* listeners = getListenersForGlobalObject(exec->lexicalGlobalObject());
    if (!listeners)
        return;
    ASSERT(!listeners->isEmpty());

    TemporaryChange<bool> change(m_callingListeners, true);

    bool isError = errorLine != -1;
    if (isError)
        dispatchFailedToParseSource(*listeners, sourceProvider, errorLine, errorMessage);
    else
        dispatchDidParseSource(*listeners, sourceProvider, isContentScript(exec));
}

void ScriptDebugServer::dispatchFunctionToListeners(const ListenerSet& listeners, JavaScriptExecutionCallback callback)
{
    Vector<ScriptDebugListener*> copy;
    copyToVector(listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        (this->*callback)(copy[i]);
}

void ScriptDebugServer::dispatchFunctionToListeners(JavaScriptExecutionCallback callback, JSGlobalObject* globalObject)
{
    if (m_callingListeners)
        return;

    TemporaryChange<bool> change(m_callingListeners, true);

    if (ListenerSet* listeners = getListenersForGlobalObject(globalObject)) {
        ASSERT(!listeners->isEmpty());
        dispatchFunctionToListeners(*listeners, callback);
    }
}

void ScriptDebugServer::notifyDoneProcessingDebuggerEvents()
{
    m_doneProcessingDebuggerEvents = true;
}

bool ScriptDebugServer::needPauseHandling(JSGlobalObject* globalObject)
{
    return !!getListenersForGlobalObject(globalObject);
}

void ScriptDebugServer::handleBreakpointHit(const JSC::Breakpoint& breakpoint)
{
    BreakpointIDToActionsMap::iterator it = m_breakpointIDToActions.find(breakpoint.id);
    if (it != m_breakpointIDToActions.end()) {
        BreakpointActions& actions = it->value;
        for (size_t i = 0; i < actions.size(); ++i) {
            if (!evaluateBreakpointAction(actions[i]))
                return;
        }
    }
}

void ScriptDebugServer::handleExceptionInBreakpointCondition(JSC::ExecState* exec, JSC::JSValue exception) const
{
    reportException(exec, exception);
}

void ScriptDebugServer::handlePause(Debugger::ReasonForPause, JSGlobalObject* dynamicGlobalObject)
{
    dispatchFunctionToListeners(&ScriptDebugServer::dispatchDidPause, dynamicGlobalObject);
    didPause(dynamicGlobalObject);

    TimerBase::fireTimersInNestedEventLoop();

    m_runningNestedMessageLoop = true;
    m_doneProcessingDebuggerEvents = false;
    runEventLoopWhilePaused();
    m_runningNestedMessageLoop = false;

    didContinue(dynamicGlobalObject);
    dispatchFunctionToListeners(&ScriptDebugServer::dispatchDidContinue, dynamicGlobalObject);
}

/*
bool ScriptDebugServer::findProbesForPosition(ScriptId scriptId, const TextPosition& position, ProbeSet& result) const
{
    if (!m_probesActivated)
        return false;

    ScriptIdToPositionsMap::const_iterator entryForScript = m_probeRegistry.find(scriptId);
    if (entryForScript == m_probeRegistry.end())
        return false;

    PositionToScriptProbeSet::const_iterator probesForPosition = entryForScript->value.find(position);
    if (probesForPosition != entryForScript->value.end()) {
        result = probesForPosition->value;
        return true;
    }

    // Since frontend truncates the indent, the first statement in a line must match probes
    // with the position (line,0).

    // N.B. the code currently assumes probes exist at either the exact location or first
    // statement on a line, but not both. If probes exist at both locations, the exact one is used.
    if (position.m_line.oneBasedInt() != m_lastExecutedLine && position.m_column != OrdinalNumber::first()) {
        TextPosition beginningOfLine(position.m_line, OrdinalNumber::first());
        PositionToScriptProbeSet::const_iterator probesForBeginningOfLine = entryForScript->value.find(beginningOfLine);
        if (probesForBeginningOfLine != entryForScript->value.end()) {
            result = probesForBeginningOfLine->value;
            return true;
        }
    }

    return false;
}

bool ScriptDebugServer::hasActiveProbes(ScriptId scriptId, const TextPosition& position) const
{
    ProbeSet foundProbes;
    if (!findProbesForPosition(scriptId, position, foundProbes))
        return false;

    ProbeSet::const_iterator probesIt = foundProbes.begin();
    for (; probesIt != foundProbes.end(); ++probesIt) {
        RefPtr<ScriptProbe> probe = *probesIt;
        if (probe->isEnabled())
            return true;
    }

    return false;
}

void ScriptDebugServer::captureProbeSamplesIfNeeded(CallFrame* callFrame)
{
#if ENABLE(WEB_REPLAY)
    // If web replay is active, only generate probe samples during replay.
    JSGlobalObject* globalObject = callFrame->dynamicGlobalObject();
    InputIterator* it = globalObject->inputIterator();
    if (it && !it->isReplaying())
        return;
#endif

    TextPosition position = DebuggerCallFrame::positionForCallFrame(callFrame);
    ProbeSet foundProbes;
    if (!findProbesForPosition(DebuggerCallFrame::sourceIdForCallFrame(callFrame), position, foundProbes))
        return;

    int batchId = m_nextBatchId++;

    ProbeSet::const_iterator probesIt = foundProbes.begin();
    for (; probesIt != foundProbes.end(); ++probesIt) {
        RefPtr<ScriptProbe> probe = *probesIt;
        JSC::JSValue exception;
        JSC::JSValue result = DebuggerCallFrame::evaluateWithCallFrame(callFrame, probe->expression(), exception);
        // TODO: (Issue #314): Propagate exception to the frontend instead of silently dropping it.
        if (exception)
            continue;

        ScriptValue wrappedResult = ScriptValue(callFrame->vm(), result);
        dispatchCaptureProbeSample(callFrame, probe, batchId, wrappedResult);
    }
}
*/

void ScriptDebugServer::recompileAllJSFunctionsSoon()
{
    m_recompileTimer.startOneShot(0);
}

void ScriptDebugServer::compileScript(JSC::ExecState*, const String&, const String&, String*, String*)
{
    // FIXME(89652): implement this.
}

void ScriptDebugServer::clearCompiledScripts()
{
    // FIXME(89652): implement this.
}

void ScriptDebugServer::runScript(JSC::ExecState*, const String&, ScriptValue*, bool*, String*)
{
    // FIXME(89652): implement this.
}

} // namespace WebCore

#endif // ENABLE(JAVASCRIPT_DEBUGGER)
