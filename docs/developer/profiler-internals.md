# WebKit JavaScript Profiler Internals

<div id="generated-toc"></div>

This guide is current as of WebKit r72490, the SVN revision of WebKit
that we branched from. You can view the state of the sources at this
revision by visiting
[this Trac link](https://trac.webkit.org/browser/trunk/WebCore/inspector?rev=72490).

Since that revision was current as of 11/20/2010, any mainline changes
since then have not been backported into this manual.

## Overview

The JS Profiler (profiler henceforth) is used to figure out where
execution time is spent by JavaScript code. It has the unique position
in the project as being a feature that is controlled more or less
directly by WebCore, but implemented mostly in JavaScriptCore. This is
similar to the desired architecture of Timelapse features, so it is
good to study the design of the profiler and copy the parts that are
necessary.

## What happens when profiling

WebKit instruments (i.e., adds extra bytecodes) the executing code
itself to record profiling data (right now, just function
entry/exits). In addition to code instrumentation, some parts of the
interpreter are instrumented themselves. When profiling is enabled,
function `recompileAllFunctionsSoon` is called which forces a
recompilation into interpreter bytecodes. Subsequent execution of JS
will then be profiled.

Under the hood, each `ExecState` (which corresponds to one `Page` and
is also typedef'd as `ScriptState`) has its own
`JSC::ProfileGenerator`. During execution, the code asks for the
current profiler reference (via
`JSC::Profiler::enabledProfilerReference()`), and if one is returned,
then methods like `willExecute(state, function, ...)` are
called. These generate profile events in the respective profile
generator.

When the profiling is done, the `ProfileGenerator` creates a `Profile`
object, which can then be queried elsewhere to know what happened
during the profile.

## Enabling and disabling profiling

Profiling is ultimately enabled and dispabled by the user interacting
with Web Inspector, and possibly by the WebKit embedder. For example,
mobile ports may want to disable profiling unconditionally. Let's
trace the steps:

1.  The user clicks somewhere in the UI which eventually sends the
    `enableProfiler` Inspector API message to the backend.

2.  This is handled by `InspectorController::enableProfiler`, which
    calls `InspectorProfilerAgent::enable`.

3.  `InspectorProfilerAgent::enable` sets `m_enabled = true`, calls
    `ScriptDebugServer::shared().recompileAllJSFunctionsSoon()`, then
    sends the `profilerWasEnabled()` message to the frontend.

4.  The recompile message waits until the JS call stack is empty, then
    calls `JSC::Debugger::recompileAllJSFunctions`. After these have
    been recompiled, it is now <em>possible</em> to profile when
    desired.

Disabling profiling follows the same steps, but with different names.

## Starting and stopping profiling

Actually starting and stopping profiling happens in much the same way
as enabling and disabling. The exception is that stopping profiling
results in a Profile object (representing the profile results) that
can be queried. Another thing to note is that starting profiling will
implicitly enable it, if not previously enabled.

1.  The user clicks somewhere in the UI, which eventually sends the
    `startProfiling` Inspector API message to the backend.

2.  This function immediately redirects to
    `InspectorProfilerAgent::startUserInitiatedProfiling`

3.  This function causes all JS to be recompiled (as above), toggles
    the Record button in the UI (`toggleRecordButton`), and calls
    `ScriptProfiler::start` with the current `ExecState*` pointer
    (derived from the inspected `Page`'s `Frame` using
    `toJSDOMWindow`).

4.  `ScriptProfiler::start` forwards the request across the
    WebCore/JSC boundary to `JSC::Profiler::startProfiling`

5.  `Profiler::startProfiling` creates a new `ProfileGenerator` object
    if one has not yet been created yet for this combination of
    `ExecState*` and generated title. It is stored in a Vector of
    ProfileGenerators.

Stopping profiling is much the same, except that the ProfileGenerator
is destroyed, a `Profile` object is created and returned
backwards. The Profile object is wrapped inside a
`WebCore::ScriptProfile` object inside of `ScriptProfiler::end`.
