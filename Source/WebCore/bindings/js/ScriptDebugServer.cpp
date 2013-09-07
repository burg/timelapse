/*
 * Copyright (C) 2008, 2009 Apple Inc. All rights reserved.
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
    , m_recompileTimer(this, &ScriptDebugServer::recompileAllJSFunctions)
    , m_lastExecutedLine(-1)
    , m_lastExecutedSourceId(-1)
    , m_nextBatchId(1)
{
    clearPauseTrigger();
}

ScriptDebugServer::~ScriptDebugServer()
{
    ScriptIdToPositionsMap::iterator scriptsIt = m_probeRegistry.begin();
    for (; scriptsIt != m_probeRegistry.end(); ++scriptsIt)
        clearProbesForScriptId(scriptsIt->key);

    m_probeRegistry.clear();
}

String ScriptDebugServer::setBreakpoint(const String& sourceID, const ScriptBreakpoint& scriptBreakpoint, int* actualLineNumber, int* actualColumnNumber)
{
    intptr_t sourceIDValue = sourceID.toIntPtr();
    if (!sourceIDValue)
        return "";
    SourceIdToBreakpointsMap::iterator it = m_sourceIdToBreakpoints.find(sourceIDValue);
    if (it == m_sourceIdToBreakpoints.end())
        it = m_sourceIdToBreakpoints.set(sourceIDValue, LineToBreakpointMap()).iterator;
    LineToBreakpointMap::iterator breaksIt = it->value.find(scriptBreakpoint.lineNumber + 1);
    if (breaksIt == it->value.end())
        breaksIt = it->value.set(scriptBreakpoint.lineNumber + 1, BreakpointsInLine()).iterator;

    BreakpointsInLine& breaksVector = breaksIt->value;
    unsigned breaksCount = breaksVector.size();
    for (unsigned i = 0; i < breaksCount; i++) {
        if (breaksVector.at(i).columnNumber == scriptBreakpoint.columnNumber)
            return "";
    }
    breaksVector.append(scriptBreakpoint);

    *actualLineNumber = scriptBreakpoint.lineNumber;
    *actualColumnNumber = scriptBreakpoint.columnNumber;
    return sourceID + ":" + String::number(scriptBreakpoint.lineNumber) + ":" + String::number(scriptBreakpoint.columnNumber);
}

void ScriptDebugServer::removeBreakpoint(const String& breakpointId)
{
    Vector<String> tokens;
    breakpointId.split(":", tokens);
    if (tokens.size() != 3)
        return;
    bool success;
    intptr_t sourceIDValue = tokens[0].toIntPtr(&success);
    if (!success)
        return;
    unsigned lineNumber = tokens[1].toUInt(&success);
    if (!success)
        return;
    unsigned columnNumber = tokens[2].toUInt(&success);
    if (!success)
        return;

    SourceIdToBreakpointsMap::iterator it = m_sourceIdToBreakpoints.find(sourceIDValue);
    if (it == m_sourceIdToBreakpoints.end())
        return;
    LineToBreakpointMap::iterator breaksIt = it->value.find(lineNumber + 1);
    if (breaksIt == it->value.end())
        return;

    BreakpointsInLine& breaksVector = breaksIt->value;
    unsigned breaksCount = breaksVector.size();
    for (unsigned i = 0; i < breaksCount; i++) {
        if (breaksVector.at(i).columnNumber == static_cast<int>(columnNumber)) {
            breaksVector.remove(i);
            break;
        }
    }
}

bool ScriptDebugServer::hasBreakpoint(intptr_t sourceID, const TextPosition& position, ScriptBreakpoint *hitBreakpoint) const
{
    if (!m_breakpointsActivated)
        return false;

    SourceIdToBreakpointsMap::const_iterator it = m_sourceIdToBreakpoints.find(sourceID);
    if (it == m_sourceIdToBreakpoints.end())
        return false;

    int lineNumber = position.m_line.zeroBasedInt();
    int columnNumber = position.m_column.zeroBasedInt();
    if (lineNumber < 0 || columnNumber < 0)
        return false;

    LineToBreakpointMap::const_iterator breaksIt = it->value.find(lineNumber + 1);
    if (breaksIt == it->value.end())
        return false;

    bool hit = false;
    const BreakpointsInLine& breaksVector = breaksIt->value;
    unsigned breaksCount = breaksVector.size();
    unsigned i;
    for (i = 0; i < breaksCount; i++) {
        int breakLine = breaksVector.at(i).lineNumber;
        int breakColumn = breaksVector.at(i).columnNumber;
        // Since frontend truncates the indent, the first statement in a line must match the breakpoint (line,0).
        if ((lineNumber != m_lastExecutedLine && lineNumber == breakLine && !breakColumn)
            || (lineNumber == breakLine && columnNumber == breakColumn)) {
            hit = true;
            break;
        }
    }
    if (!hit)
        return false;

    if (hitBreakpoint)
        *hitBreakpoint = breaksVector.at(i);

    // An empty condition counts as no condition which is equivalent to "true".
    if (breaksVector.at(i).condition.isEmpty())
        return true;

    JSValue exception;
    JSValue result = m_currentCallFrame->evaluate(breaksVector.at(i).condition, exception);
    if (exception) {
        // An erroneous condition counts as "false".
        reportException(m_currentCallFrame->exec(), exception);
        return false;
    }
    return result.toBoolean(m_currentCallFrame->exec());
}

bool ScriptDebugServer::evaluateBreakpointAction(const ScriptBreakpointAction& breakpointAction) const
{
    switch (breakpointAction.type) {
    case ScriptBreakpointActionTypeLog: {
        DOMWindow* window = asJSDOMWindow(m_currentCallFrame->dynamicGlobalObject())->impl();
        if (PageConsole* console = window->pageConsole())
            console->addMessage(JSMessageSource, LogMessageLevel, breakpointAction.data);
        break;
    }
    case ScriptBreakpointActionTypeEvaluate: {
        JSValue exception;
        m_currentCallFrame->evaluate(breakpointAction.data, exception);
        if (exception)
            reportException(m_currentCallFrame->exec(), exception);
        break;
    }
    case ScriptBreakpointActionTypeSound:
        systemBeep();
        break;
    }

    return true;
}

bool ScriptDebugServer::evaluateBreakpointActions(const ScriptBreakpoint& breakpoint) const
{
    for (size_t i = 0; i < breakpoint.actions.size(); ++i) {
        if (!evaluateBreakpointAction(breakpoint.actions[i]))
            return false;
    }

    return true;
}

void ScriptDebugServer::clearBreakpoints()
{
    m_sourceIdToBreakpoints.clear();
}

void ScriptDebugServer::setBreakpointsActivated(bool activated)
{
    m_breakpointsActivated = activated;
}

void ScriptDebugServer::setProbesActivated(bool activated)
{
    m_probesActivated = activated;
}

void ScriptDebugServer::setPauseOnExceptionsState(PauseOnExceptionsState pause)
{
    m_pauseOnExceptionsState = pause;
}

void ScriptDebugServer::setPauseOnNextStatement(bool pause)
{
    m_pauseOnNextStatement = pause;
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

void ScriptDebugServer::breakProgram()
{
    if (m_paused || !m_currentCallFrame)
        return;

    m_pauseOnNextStatement = true;
    pauseIfNeeded(m_currentCallFrame->dynamicGlobalObject());
}

void ScriptDebugServer::continueProgram()
{
    if (!m_paused)
        return;

    m_pauseOnNextStatement = false;
    m_doneProcessingDebuggerEvents = true;
}

void ScriptDebugServer::stepIntoStatement()
{
    if (!m_paused)
        return;

    m_pauseOnNextStatement = true;
    m_doneProcessingDebuggerEvents = true;
}

void ScriptDebugServer::stepOverStatement()
{
    if (!m_paused)
        return;

    m_pauseOnCallFrame = m_currentCallFrame.get();
    m_doneProcessingDebuggerEvents = true;
}

void ScriptDebugServer::stepOutOfFunction()
{
    if (!m_paused)
        return;

    m_pauseOnCallFrame = m_currentCallFrame ? m_currentCallFrame->caller() : 0;
    m_doneProcessingDebuggerEvents = true;
}

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
    ASSERT(m_paused);
    JSGlobalObject* globalObject = m_currentCallFrame->scopeChain()->globalObject();
    ScriptState* state = globalObject->globalExec();
    JSValue jsCallFrame;
    {
        if (m_currentCallFrame->isValid() && globalObject->inherits(JSDOMGlobalObject::info())) {
            JSDOMGlobalObject* domGlobalObject = jsCast<JSDOMGlobalObject*>(globalObject);
            JSLockHolder lock(state);
            jsCallFrame = toJS(state, domGlobalObject, m_currentCallFrame.get());
        } else
            jsCallFrame = jsUndefined();
    }
    listener->didPause(state, ScriptValue(state->vm(), jsCallFrame), ScriptValue());
}

void ScriptDebugServer::dispatchDidContinue(ScriptDebugListener* listener)
{
    listener->didContinue();
}

void ScriptDebugServer::dispatchWillParseSource(const ListenerSet& listeners, ScriptDebugListener::Script& script)
{
    Vector<ScriptDebugListener*> copy;
    copyToVector(listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->willParseSource(script);
}

void ScriptDebugServer::dispatchDidParseSource(const ListenerSet& listeners, ScriptDebugListener::Script& script)
{
    Vector<ScriptDebugListener*> copy;
    copyToVector(listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->didParseSource(script);
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

void ScriptDebugServer::dispatchCaptureProbeSample(ScriptState* exec, PassRefPtr<ScriptProbe> prpProbe, int batchId, const ScriptValue& sample)
{
    RefPtr<ScriptProbe> probe = prpProbe;
    ListenerSet* listeners = getListenersForGlobalObject(exec->dynamicGlobalObject());
    Vector<ScriptDebugListener*> copy;
    copyToVector(*listeners, copy);
    for (size_t i = 0; i < copy.size(); ++i)
        copy[i]->captureProbeSample(exec, probe, batchId, sample);
}

bool ScriptDebugServer::isContentScript(ExecState* exec)
{
    return currentWorld(exec) != mainThreadNormalWorld();
}

void ScriptDebugServer::detach(JSGlobalObject* globalObject)
{
    // If we're detaching from the currently executing global object, manually tear down our
    // stack, since we won't get further debugger callbacks to do so. Also, resume execution,
    // since there's no point in staying paused once a window closes.
    if (m_currentCallFrame && m_currentCallFrame->dynamicGlobalObject() == globalObject) {
        m_currentCallFrame = 0;
        m_pauseOnCallFrame = 0;
        continueProgram();
    }
    Debugger::detach(globalObject);
}

static void createDebugListenerScriptObject(SourceProvider* sourceProvider, bool isContentScript, ScriptDebugListener::Script& script)
{
    script.url = sourceProvider->url();
    script.source = sourceProvider->source();
    script.sourceID = String::number(sourceProvider->asID());
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
    if (isError) {
        dispatchFailedToParseSource(*listeners, sourceProvider, errorLine, errorMessage);
        return;
    }

    ScriptDebugListener::Script script;
    createDebugListenerScriptObject(sourceProvider, isContentScript(exec), script);

    // This fires two listeners because some actions (sending content to frontend)
    // should not be coupled to other actions (resolving probes and breakpoints).
    // FIXME: The names should be improved to clarify that script is already parsed
    // before either event fires.
    dispatchWillParseSource(*listeners, script);

    // Recompute listeners, since they may have been modified.
    listeners = getListenersForGlobalObject(exec->lexicalGlobalObject());
    if (!listeners)
        return;

    ASSERT(!listeners->isEmpty());
    dispatchDidParseSource(*listeners, script);
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

void ScriptDebugServer::createCallFrame(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    TextPosition textPosition(OrdinalNumber::fromOneBasedInt(lineNumber), OrdinalNumber::fromOneBasedInt(columnNumber));
    m_currentCallFrame = JavaScriptCallFrame::create(debuggerCallFrame, m_currentCallFrame, sourceID, textPosition);
    if (m_lastExecutedSourceId != sourceID) {
        m_lastExecutedLine = -1;
        m_lastExecutedSourceId = sourceID;
    }
}

void ScriptDebugServer::updateCallFrameAndPauseIfNeeded(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    // ASSERT(m_currentCallFrame);
    if (!m_currentCallFrame)
        return;

    TextPosition textPosition(OrdinalNumber::fromOneBasedInt(lineNumber), OrdinalNumber::fromOneBasedInt(columnNumber));
    m_currentCallFrame->update(debuggerCallFrame, sourceID, textPosition);
    pauseIfNeeded(debuggerCallFrame.dynamicGlobalObject());
}

void ScriptDebugServer::pauseIfNeeded(JSGlobalObject* dynamicGlobalObject)
{
    if (m_paused)
        return;

    if (!getListenersForGlobalObject(dynamicGlobalObject))
        return;

    ScriptBreakpoint breakpoint;
    bool didHitBreakpoint = false;
    bool pauseNow = m_pauseOnNextStatement;
    pauseNow |= (m_pauseOnCallFrame == m_currentCallFrame);
    pauseNow |= didHitBreakpoint = hasBreakpoint(m_currentCallFrame->sourceID(), m_currentCallFrame->position(), &breakpoint);
    pauseNow |= hasActiveProbes(m_currentCallFrame->sourceID(), m_currentCallFrame->position());
    m_lastExecutedLine = m_currentCallFrame->position().m_line.zeroBasedInt();
    if (!pauseNow)
        return;

    if (didHitBreakpoint) {
        evaluateBreakpointActions(breakpoint);
        if (breakpoint.autoContinue)
            return;
    }

    m_pauseOnCallFrame = 0;
    m_pauseOnNextStatement = false;
    m_paused = true;

    dispatchFunctionToListeners(&ScriptDebugServer::dispatchDidPause, dynamicGlobalObject);
    didPause(dynamicGlobalObject);

    TimerBase::fireTimersInNestedEventLoop();

    m_runningNestedMessageLoop = true;
    m_doneProcessingDebuggerEvents = false;
    runEventLoopWhilePaused();
    m_runningNestedMessageLoop = false;

    didContinue(dynamicGlobalObject);
    dispatchFunctionToListeners(&ScriptDebugServer::dispatchDidContinue, dynamicGlobalObject);

    m_paused = false;
}

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

void ScriptDebugServer::captureProbeSamplesIfNeeded(const JSC::DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
#if ENABLE(WEB_REPLAY)
    // If web replay is active, only generate probe samples during replay.
    JSC::JSGlobalObject* globalObject = debuggerCallFrame.dynamicGlobalObject();
    InputIterator* it = globalObject->inputIterator();
    if (it && !it->isReplaying())
        return;
#endif

    TextPosition textPosition(OrdinalNumber::fromOneBasedInt(lineNumber), OrdinalNumber::fromOneBasedInt(columnNumber));

    ProbeSet foundProbes;
    if (!findProbesForPosition(sourceID, textPosition, foundProbes))
        return;

    int batchId = m_nextBatchId++;

    ProbeSet::const_iterator probesIt = foundProbes.begin();
    for (; probesIt != foundProbes.end(); ++probesIt) {
        RefPtr<ScriptProbe> probe = *probesIt;
        JSC::JSValue exception;
        JSC::JSValue result = debuggerCallFrame.evaluate(probe->expression(), exception);
        // TODO: (Issue #314): Propagate exception to the frontend instead of silently dropping it.
        if (exception)
            continue;

        ScriptValue wrappedResult = ScriptValue(debuggerCallFrame.callFrame()->vm(), result);
        dispatchCaptureProbeSample(debuggerCallFrame.callFrame(), probe, batchId, wrappedResult);
    }
}

void ScriptDebugServer::callEvent(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    if (!m_paused) {
        createCallFrame(debuggerCallFrame, sourceID, lineNumber, columnNumber);
        pauseIfNeeded(debuggerCallFrame.dynamicGlobalObject());
    }
}

void ScriptDebugServer::atStatement(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    captureProbeSamplesIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);

    if (!m_paused)
        updateCallFrameAndPauseIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);
}

void ScriptDebugServer::returnEvent(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    if (m_paused)
        return;

    updateCallFrameAndPauseIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);

    // detach may have been called during pauseIfNeeded
    if (!m_currentCallFrame)
        return;

    // Treat stepping over a return statement like stepping out.
    if (m_currentCallFrame == m_pauseOnCallFrame)
        m_pauseOnCallFrame = m_currentCallFrame->caller();
    m_currentCallFrame = m_currentCallFrame->caller();
}

void ScriptDebugServer::exception(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber, bool hasHandler)
{
    if (m_paused)
        return;

    if (m_pauseOnExceptionsState == PauseOnAllExceptions || (m_pauseOnExceptionsState == PauseOnUncaughtExceptions && !hasHandler))
        m_pauseOnNextStatement = true;

    updateCallFrameAndPauseIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);
}

void ScriptDebugServer::willExecuteProgram(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    if (!m_paused) {
        createCallFrame(debuggerCallFrame, sourceID, lineNumber, columnNumber);
        pauseIfNeeded(debuggerCallFrame.dynamicGlobalObject());
    }
}

void ScriptDebugServer::didExecuteProgram(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    if (m_paused)
        return;

    updateCallFrameAndPauseIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);

    // Treat stepping over the end of a program like stepping out.
    if (!m_currentCallFrame)
        return;
    if (m_currentCallFrame == m_pauseOnCallFrame) {
        m_pauseOnCallFrame = m_currentCallFrame->caller();
        if (!m_currentCallFrame)
            return;
    }
    m_currentCallFrame = m_currentCallFrame->caller();
}

void ScriptDebugServer::didReachBreakpoint(const DebuggerCallFrame& debuggerCallFrame, intptr_t sourceID, int lineNumber, int columnNumber)
{
    if (m_paused)
        return;

    m_pauseOnNextStatement = true;
    updateCallFrameAndPauseIfNeeded(debuggerCallFrame, sourceID, lineNumber, columnNumber);
}

void ScriptDebugServer::recompileAllJSFunctionsSoon()
{
    m_recompileTimer.startOneShot(0);
}

void ScriptDebugServer::compileScript(ScriptState*, const String&, const String&, String*, String*)
{
    // FIXME(89652): implement this.
}

void ScriptDebugServer::clearCompiledScripts()
{
    // FIXME(89652): implement this.
}

void ScriptDebugServer::runScript(ScriptState*, const String&, ScriptValue*, bool*, String*)
{
    // FIXME(89652): implement this.
}

} // namespace WebCore

#endif // ENABLE(JAVASCRIPT_DEBUGGER)
