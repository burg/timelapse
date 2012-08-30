# Web Inspector Internals

<div id="generated-toc"></div>

This guide is current as of the revision it was checked in. If
changes have been pulled from upstream WebKit, some of these details
may be inaccurate.

## Architecture

Web Inspector has three major components, each of which are briefly
detailed below. The intent is that these components are replaceable
and somewhat modular. Practically speaking, the frontend is the UI,
the target is the program being debugged, and the backend tells the
frontend some information about the target.


### Inspector frontend (Web Inspector)

The inspector frontend is the user interface that Web Inspector's
users see and interact with. The frontend is implemented in
JavaScript, HTML, and CSS. Interactions are scripted as in web
applications. Sometimes this frontend is referred to as the debug
client (whereas the backend is referred to as the server).

At a code level, the file `inspector.js` implements `WebInspector`,
the central JavaScript object in the web inspector. The implementation
files for the frontend exist in the
`WebKit/Source/WebCore/inspector/front-end/' directory.

Ultimately, somewhere the extra window for Web Inspector must be
managed by the particular GUI port of WebKit. This functionality is
implemented by a `InspectorFrontendHost` object, which is a stub JS
object that's actually implemented by each port.

### Target program/debuggee

The program being debugged is typically called the _target_. In normal
operation of Web Inspector, the target program is that which is
currently loaded by the browser. However, it is conceivable that the
target program is not currently running in the browser&ndash; that is,
it could be executing remotely. This is the premise behind experiments
like:

* [Node Inspector](https://github.com/dannycoates/node-inspector/)

> A [NodeJS](http://www.nodejs.org) debugger that resuses Web
> Inspector's script debugger frontend.

* [weinre](http://pmuellr.github.com/weinre/)

> A remote debugger for web pages that do not have debuggers
> available (say, mobile versions of web browsers).

In a sense, Timelapse also falls into the category of "debugging
something not currently in the browser window", because JavaScript
executions that we \[want to\] display in the debugger window are not
live, but instead come from a trace.

In the WebCore (default) debugging target, information about the
current target is gleaned through many small instrumentation hooks
throughout the rest of the codebase. For JavaScript, these debugger
hooks are part of the VM API. For WebCore (DOM, network, resources
implementation), these hooks are scattered about in an ad-hoc
way. Those curious can simply grep backwards from
`InspectorController` (below) to find these points of instrumentation.

### Inspector backend

The backend is what conceptually mediates between the target program
and the front-end debugger UI. For normal Web Inspector, this mediates
between the current page executing (well, its JavaScript interpreter
and DOM) and the frontend; it is part of WebCore and written in
C++. In the other projects mentioned above, the backend proxies
messages to and from debug servers written in other languages and
residing in different processes.

In the WebCore (default) backend, most of the actual orchestration
logic resides in the `InspectorController` class.

### Architecture diagram

<img src="webinspector-architecture.png" width="100%"/>

A little bit about the diagram: The frontend here is `WebInspector`,
and the backend is `Page`. Each part inside has a particular purpose:

* `WebInspector`

> Contains the central logic of the frontend.

* `WebInspector.InspectorBackend`

> A stub object callable from JavaScript whose methods, when called,
> forward the invocation to the backend.

* `InspectorBackend`

> An auto-generated class that receives messages from the frontend,
> and dispatches them to the correct C++ implementations.

* `InspectorFrontend`

> A C++ object whose methods, when called, forward the invocation to
> the frontend.

* `InspectorController`

> The main guts of the inspector backend. This is the main entry point
> that is called by instrumentation hooks scattered across the rest of
> the browser.

* `InjectedScript`

> Some backend functions are implemented directly in JavaScript that
> is injected into the target page and runs directly on the target
> program's heap. To run JavaScript in the target page, the inspector
> must follow this indirection since it uses a JS interpreter that is
> disjoint from the target page. The implementation of this injected
> script is located at `InjectedScript.js`.

* `InjectedScriptHost` (left, not pictured)

> Some functions in `InjectedScript` require special information not
> available to normal JavaScript programs. For example, it must map
> between a serialized object id (number) and a reference to the
> actual object. `InjectedScriptHost` is exposed to `InjectedScript`
> as a stub JavaScript object that's implemented in C++.

## Communication

Understanding the different components is not too hard, but the
communication between them is extremely intricate and largely
undocumented from a top-down perspective. Here's what I've been able
to figure out, broken down by which components are communicating.


### Backend <-> Target Program

TODO: request setting of breakpoints, edit of DOM nodes, etc

TODO: instrumentation, events

### Backend <-> Frontend

Communication between the debugger frontend and backend is done via
JSON over [WebSockets](http://en.wikipedia.org/wiki/WebSockets) and by
inserting and eval'ing raw JavaScript. The API is currently described
by the `Inspector.json` file using a specially-structured object
format.

The specifications are used to automatically generate bindings on
either side of the module boundary. These bindings live in the files
below:

* `InspectorBackendDispatcher.h`, `InspectorBackendDispatcher.cpp`
* `InspectorFrontend.h,` `InspectorFrontend.cpp`
* `InspectorBackendStub.js`

(Previously (early 2010 and before), the file
`CodeGeneratorInspector.pm` generated JS and C++ bindings from the
`Inspector.idl` specification. In early 2011, the specification
switched to JSON, and this JSON was converted to IDL with the
`generate-inspector-idl` script. In late October 2011, this two-step
process was replaced with a single python script to make bindings
directly out of the JSON specification. See older revisions of this
document for examples based on IDL.)

The specification has several _domains_, which correspond roughly to
panels of the dev tools. Each domain has a name, description, and
lists each of _types_, _commands_, and _events_.

<pre class="brush: js; highlight: [1,2,10]">
    {
        "domain": "Timeline",
        "description": "Timeline provides its clients with instrumentation records that are generated during the page runtime. Timeline instrumentation can be started and stopped using corresponding commands. While timeline is started, it is generating timeline event records.",
        "types": [
            {
                "id": "TimelineEvent",
                "type": "object",
                "properties": [
                    { "name": "type", "type": "string", "description": "Event type." },
                    { "name": "data", "type": "object", "description": "Event data." },
                    { "name": "children", "type": "array", "optional": true, "items": { "$ref": "TimelineEvent" }, "description": "Nested records." }
                ],
                "description": "Timeline record contains information about the recorded activity."
            }
        ],
        "commands": [
            {
                "name": "start",
                "parameters": [
                    { "name": "maxCallStackDepth", "optional": true, "type": "integer", "description": "Samples JavaScript stack traces up to <code>maxCallStackDepth</code>, defaults to 5." }
                ],
                "description": "Starts capturing instrumentation events."
            },
            ...
	 ],
	 "events": [
            {
                "name": "started",
                "description": "Fired when timeline has been started.",
                "hidden": true
            },
	    ...
	 ],
	 ...
</pre>

_Types_ are descriptions of datatypes, implemented as JSON
objects. They describe the expected fields and how they are to be
interpreted. The datatype can be referenced elsewhere (say, in
parameter specifications) by using the key-value pair `"$ref":
"TypeName"`. Most of the descriptions are easy to follow.

_Commands_ are functionality implemented by the backend, and called by
the frontend. For example, when the Timeline should start, it calls
the `Timeline.start` method, whose implementation in the backend
starts collecting records.

_Events_ are essentially named frontend callbacks that
are invoked by the backend. These asynchronous calls are the main
method of moving data from the backend to the frontend. In the code
above, once the Timeline is actually recording data, the `started`
method is called by the backend. The frontend then responds to the
event, possibly by making the recording button appear "on".

#### Peeking at frontend-backend communications

One of the benefits of a debugger frontend written as a web
application is that it can debug itself; that is, a debugger instance
debugging a target webpage can itself be debugged by another debugger
instance. This can be useful to see the DOM structure of the web
inspector, but more importantly it lets you mess around with the
JavaScript/DOM state of one debugger using the other.

As one example, you can set a flag that will dump all RPC calls
between frontend and backend. Simply type
`InspectorBackendStub.prototype.dumpInspectorProtocolMessages = true` into the second-level
debugger's console. You should see messages pour into the second-level
console whenever something happens in the first-level debugger.

Another example is that you can interactively peek around at the
various properties of any Web Inspector object. You can even fake up a
call to the backend to see what happens. Most importantly, you can
test your change to the debugger frontend without having to
rebuild/recompile WebKit.


#### Web Inspector's frontend-backend protocol

An unverified list of the Web Inspector protocol messages is at the
following link:

* <https://sites.google.com/site/webinspectorprotocol/home>

## WebCore Backend

### Sending messages to Frontend

Throughout `InspectorController.cpp` and other parts of the backend,
calls are made to the frontend. This starts with a call to some method
of the `InspectorFrontend` class, which is automatically generated
from `Inspector.json`. For example, the `breakpointResolved` API of the
frontend, in specification and boilerplate:

<pre class="brush: js">
    {
        "domain": "Debugger",
        "description": "Debugger domain exposes JavaScript debugging capabilities. It allows setting and removing breakpoints, stepping through execution, exploring stack traces, etc.",
        "types": [
            {
                "id": "BreakpointId",
                "type": "string",
                "description": "Breakpoint identifier."
            },
	    ...
            {
                "id": "Location",
                "type": "object",
                "properties": [
                    { "name": "scriptId", "$ref": "ScriptId", "description": "Script identifier as reported in the <code>Debugger.scriptParsed</code>." },
                    { "name": "lineNumber", "type": "integer", "description": "Line number in the script." },
                    { "name": "columnNumber", "type": "integer", "optional": true, "description": "Column number in the script." }
                ],
                "description": "Location in the source code."
            },
	 ],
	 ...
	 "events": [
	    ...
            {
                "name": "breakpointResolved",
                "parameters": [
                    { "name": "breakpointId", "$ref": "BreakpointId", "description": "Breakpoint unique identifier." },
                    { "name": "location", "$ref": "Location", "description": "Actual breakpoint location." }
                ],
                "description": "Fired when breakpoint is resolved to an actual script and location."
            },
	    ...
	 ],
     }
</pre>

This is how `InspectorFrontend::breakpointResolved` is used:

<pre class="brush: cpp">
PassRefPtr<InspectorObject> InspectorDebuggerAgent::resolveBreakpoint(const String& breakpointId, const String& scriptId, const ScriptBreakpoint& breakpoint)
{
    ...
    RefPtr<InspectorObject> location = InspectorObject::create();
    location->setString("scriptId", scriptId);
    location->setNumber("lineNumber", actualLineNumber);
    location->setNumber("columnNumber", actualColumnNumber);
    m_frontend->breakpointResolved(it->first, location);
</pre>

This is the C++ binding:

<pre class="brush: cpp; highlight: [12]">
void InspectorFrontend::Debugger::breakpointResolved(const String& breakpointId, PassRefPtr<InspectorObject> location)
{
    RefPtr<InspectorObject> breakpointResolvedMessage = InspectorObject::create();
    breakpointResolvedMessage->setString("method", "Debugger.breakpointResolved");
    RefPtr<InspectorObject> paramsObject = InspectorObject::create();
    paramsObject->setString("breakpointId", breakpointId);
    paramsObject->setObject("location", location);
    breakpointResolvedMessage->setObject("params", paramsObject);
    if (m_inspectorFrontendChannel)
        m_inspectorFrontendChannel->sendMessageToFrontend(breakpointResolvedMessage->toJSONString());
}
</pre>

This last line calls `InspectorClient.sendMessageToFrontEnd`, which
actually sends the message. The `InspectorClient` class is subclassed
by each of the WebKit ports (GTK, QT, Chromium, Mac, etc) but
generally does something like this (Chromium version of
`WebInspectorClient.cpp`):

<pre class="brush: cpp; highlight: [9]">
bool WebInspectorClient::sendMessageToFrontend(const String& message)
{
    WebInspector* inspector = m_page->inspector();
    if (!inspector)
        return false;
    WebPage* inspectorPage = inspector->inspectorPage();
    if (!inspectorPage)
        return false;
    return doDispatchMessageOnFrontendPage(inspectorPage->corePage(), message);
}
</pre>

Then, `doDispatchMessageOnFrontendPage` simply eval's the message on
the correct webpage (from `InspectorClient.cpp`):

<pre class="brush: cpp">
bool InspectorClient::doDispatchMessageOnFrontendPage(Page* frontendPage, const String& message)
{
    if (!frontendPage)
        return false;

    Frame* frame = frontendPage->mainFrame();
    if (!frame)
        return false;

    ScriptController* scriptController = frame->script();
    if (!scriptController)
        return false;

    String dispatchToFrontend("WebInspector.dispatchMessageFromBackend(");
    dispatchToFrontend += message;
    dispatchToFrontend += ");";

    // Do not call executeInWorld here since it will end up calling Document::updateStyleForAllDocuments().
    // As a result we might re-enter CSSStyleSelector::styleForElement() which is terrible.
    scriptController->evaluate(ScriptSourceCode(dispatchToFrontend));
    return true;
}
</pre>


### Receiving messages from Frontend

For example, the frontend calls the `highlightDOMNode` method. First,
this goes through the WebSocket, and is decoded by the dispatcher
(some extraneous checks and dispatch map entries omitted, important
lines highlighted):

<pre class="brush: cpp; highlight: [14, 3, 8, 21, 29, 35]">
void InspectorBackendDispatcher::dispatch(const String& message)
{
    typedef void (InspectorBackendDispatcher::*CallHandler)(long callId, InspectorObject* messageObject);
    typedef HashMap&lt;String, CallHandler&gt; DispatchMap;
    DEFINE_STATIC_LOCAL(DispatchMap, dispatchMap, );
    long callId = 0;

    if (dispatchMap.isEmpty()) {
        dispatchMap.add(setBreakpointCmd, &InspectorBackendDispatcher::setBreakpoint);
        dispatchMap.add(enableProfilerCmd, &InspectorBackendDispatcher::enableProfiler);

    ...

        dispatchMap.add(highlightDOMNodeCmd, &InspectorBackendDispatcher::highlightDOMNode);

    ...

        dispatchMap.add(dispatchOnInjectedScriptCmd, &InspectorBackendDispatcher::dispatchOnInjectedScript);
    }

    RefPtr&lt;InspectorValue&gt; parsedMessage = InspectorValue::parseJSON(message);
    if (!parsedMessage) {
        reportProtocolError(callId, "Protocol Error: Invalid message format. Message should be in JSON format.");
        return;
    }

    ...

    HashMap&lt;String, CallHandler&gt;::iterator it = dispatchMap.find(command);
    if (it == dispatchMap.end()) {
        reportProtocolError(callId, makeString("Protocol Error: Invalid command was received. '", command, "' wasn't found."));
        return;
    }

    ((*this).*it->second)(callId, messageObject.get());
}
</pre>

Then, it is passed off to the method-specific unpacking function
(generated from `Inspector.idl`):

<pre class="brush: cpp">
void InspectorBackendDispatcher::highlightDOMNode(long callId, InspectorObject* requestMessageObject)
{
    RefPtr&lt;InspectorArray&gt; protocolErrors = InspectorArray::create();

    if (!m_inspectorController)
        protocolErrors->pushString("Protocol Error: Inspector handler is not available.");

    if (RefPtr&lt;InspectorObject&gt; argumentsContainer = requestMessageObject->getObject("arguments")) {
        long nodeId = getLong(argumentsContainer.get(), "nodeId", protocolErrors.get());

        if (!protocolErrors->length())
            m_inspectorController->highlightDOMNode(nodeId);
    } else {
        protocolErrors->pushString("Protocol Error: 'arguments' property with type 'object' was not found.");
    }
    // use InspectorFrontend as a marker of WebInspector availability
    if ((callId || protocolErrors->length()) && m_inspectorController->hasFrontend()) {
        RefPtr&lt;InspectorObject> responseMessage = InspectorObject::create();
        responseMessage->setNumber("seq", callId);
        responseMessage->setString("domain", "Inspector");
        responseMessage->setBoolean("success", !protocolErrors->length());

        if (protocolErrors->length())
            responseMessage->setArray("errors", protocolErrors);
        m_inspectorController->inspectorClient()->sendMessageToFrontend(responseMessage->toJSONString());
    }
}
</pre>

This function then calls the actual implementation, which is in
`InspectorController::highlightDOMNode`:

<pre class="brush: cpp">
void InspectorController::highlightDOMNode(long nodeId)
{
    Node* node = 0;
    if (m_domAgent && (node = m_domAgent->nodeForId(nodeId)))
        highlight(node);
}
</pre>

If the actual implementation does not return a value, then a short
response containing "success" or "errors" (and list of errors) is sent
back to the frontend.

If the actual implementation happened to return a value, then the
unpacking function waits for that return value, then packages it up
and sends it back. The `getOuterHTML` API call below is one such
implementation:

<pre class="brush: js; highlight: [8, 10, 13, 27, 28, 29]">
void InspectorBackendDispatcher::getOuterHTML(long callId, InspectorObject* requestMessageObject)
{
    RefPtr&lt;InspectorArray&gt; protocolErrors = InspectorArray::create();

    if (!m_inspectorController->domAgent())
        protocolErrors->pushString("Protocol Error: DOM handler is not available.");

    String outerHTML = "";
    if (RefPtr&lt;InspectorObject&gt; argumentsContainer = requestMessageObject->getObject("arguments")) {
        long nodeId = getLong(argumentsContainer.get(), "nodeId", protocolErrors.get());

        if (!protocolErrors->length())
            m_inspectorController->domAgent()->getOuterHTML(nodeId, &outerHTML);
    } else {
        protocolErrors->pushString("Protocol Error: 'arguments' property with type 'object' was not found.");
    }
    // use InspectorFrontend as a marker of WebInspector availability
    if ((callId || protocolErrors->length()) && m_inspectorController->hasFrontend()) {
        RefPtr&lt;InspectorObject&gt; responseMessage = InspectorObject::create();
        responseMessage->setNumber("seq", callId);
        responseMessage->setString("domain", "DOM");
        responseMessage->setBoolean("success", !protocolErrors->length());

        if (protocolErrors->length())
            responseMessage->setArray("errors", protocolErrors);
        else {
            RefPtr&lt;InspectorObject&gt; responseData = InspectorObject::create();
            responseData->setString("outerHTML", outerHTML);
            responseMessage->setObject("data", responseData);
        }
        m_inspectorController->inspectorClient()->sendMessageToFrontend(responseMessage->toJSONString());
    }
}
</pre>

## WebInspector Frontend

When the `WebInspector` object loads, the `WebInspector.loaded`
function is called. It binds a WebSocket to some predefined URL
specified elsewhere in the browser.

<pre class="brush: js">
WebInspector.loaded = function()
{
    if ("page" in WebInspector.queryParamsObject) {
        WebInspector.socket = new WebSocket("ws://" + window.location.host + "/devtools/page/" + WebInspector.queryParamsObject.page);
        WebInspector.socket.onmessage = function(message) { InspectorBackend.dispatch(message.data); }
        WebInspector.socket.onerror = function(error) { console.error(error); }
        WebInspector.socket.onopen = function() {
            InspectorFrontendHost.sendMessageToBackend = WebInspector.socket.send.bind(WebInspector.socket);
            InspectorFrontendHost.loaded = WebInspector.socket.send.bind(WebInspector.socket, "loaded");
            WebInspector.doLoadedDone();
        }
        return;
    }
    WebInspector.doLoadedDone();
}
</pre>

After above setup, any subsequent call to
`InspectorFrontEndHost.sendMessageToBackend` will send the message
over the socket.

### Sending messages

Throughout the web inspector code, there are message sends. These
typically call some method of `InspectorBackend`, and correspond to
API calls in Inspector.idl. `InspectorBackend` is implemented in
`InspectorBackendStub.js`; its methods are actually bound to a helper
function that checks the validity of arguments (using validity data
below), then encodes and send the message using the above
`InspectorFrontEndHost.sendMessageToBackend`. You can see this process
in the following short snippet; note that this file is generated by
`CodeGeneratorInspector.pm`.

The following snippet is quite dense for the uninitiated. It is not
terribly important. For those interested, documentation on
<a href="https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind">bind</a>,
<a href="http://webreflection.blogspot.com/2010/07/arrayprototypeslice-vs-arrayfication.html">Array.prototype.slice</a>.

<pre class="brush: js">
WebInspector.InspectorBackendStub.prototype = {

    _registerDelegate: function(commandInfo)
    {
        var commandObject = JSON.parse(commandInfo);
        this[commandObject.command] = this.sendMessageToBackend.bind(this, commandInfo);
    },

    sendMessageToBackend: function()
    {
        var args = Array.prototype.slice.call(arguments);
        var request = JSON.parse(args.shift());

        for (var key in request.arguments) {
            if (args.length === 0) {
                console.error("Protocol Error: Invalid number of arguments for 'InspectorBackend.%s' call. It should have the next arguments '%s'.", request.command, JSON.stringify(request.arguments));
                return;
            }
            var value = args.shift();
            if (typeof value !== request.arguments[key]) {
                console.error("Protocol Error: Invalid type of argument '%s' for 'InspectorBackend.%s' call. It should be '%s' but it is '%s'.", key, request.command, request.arguments[key], typeof value);
                return;
            }
            request.arguments[key] = value;
        }

        if (args.length === 1) {
            if (typeof args[0] !== "function" && typeof args[0] !== "undefined") {
                console.error("Protocol Error: Optional callback argument for 'InspectorBackend.%s' call should be a function but its type is '%s'.", request.command, typeof args[0]);
                return;
            }
            request.seq = WebInspector.Callback.wrap(args[0]);
        }

        if (window.dumpInspectorProtocolMessages)
            console.log("frontend: " + JSON.stringify(request));

        var message = JSON.stringify(request);
        InspectorFrontendHost.sendMessageToBackend(message);
    },
</pre>

The validation data below is generated from `Inspector.json` for each
of the messages the frontend can send:

<pre class="brush: js">
...
    this._registerDelegate('{"seq": 0, "domain": "Backend", "command": "releaseWrapperObjectGroup", "arguments": {"injectedScriptId": "number","objectGroup": "string"}}');
    this._registerDelegate('{"seq": 0, "domain": "Inspector", "command": "didEvaluateForTestInFrontend", "arguments": {"testCallId": "number","jsonResult": "string"}}');
    this._registerDelegate('{"seq": 0, "domain": "Backend", "command": "getDatabaseTableNames", "arguments": {"databaseId": "number"}}');
    this._registerDelegate('{"seq": 0, "domain": "Backend", "command": "executeSQL", "arguments": {"databaseId": "number","query": "string"}}');
    this._registerDelegate('{"seq": 0, "domain": "Inspector", "command": "getDOMStorageEntries", "arguments": {"storageId": "number"}}');
    this._registerDelegate('{"seq": 0, "domain": "Inspector", "command": "setDOMStorageItem", "arguments": {"storageId": "number","key": "string","value": "string"}}');
    this._registerDelegate('{"seq": 0, "domain": "Inspector", "command": "removeDOMStorageItem", "arguments": {"storageId": "number","key": "string"}}');
}
...
</pre>

### Receiving messages

Messages can reach the frontend through two channels; first, as a
response to a backend API call (through WebSockets), and second, as
calls to `WebInspector.dispatchMessageFromBackend`. Both methods
redirect incoming messages to the `InspectorBackend.dispatch` method
(below) defined in `InspectorBackendStub.js`, which is generated from
`Inspector.json`.

<pre class="brush: js; highlight: [15, 33]">
    dispatch: function(message)
    {
        if (window.dumpInspectorProtocolMessages)
            console.log("backend: " + ((typeof message === "string") ? message : JSON.stringify(message)));

        var messageObject = (typeof message === "string") ? JSON.parse(message) : message;

        var arguments = [];
        if (messageObject.data)
            for (var key in messageObject.data)
                arguments.push(messageObject.data[key]);

        if ("seq" in messageObject) { // just a response for some request
            if (messageObject.success)
                WebInspector.Callback.processResponse(messageObject.seq, arguments);
            else {
                WebInspector.Callback.removeResponseCallbackEntry(messageObject.seq)
                this.reportProtocolError(messageObject);
            }
            return;
        }

        if (messageObject.type === "event") {
            if (!(messageObject.domain in this._domainDispatchers)) {
                console.error("Protocol Error: the message is for non-existing domain '%s'", messageObject.domain);
                return;
            }
            var dispatcher = this._domainDispatchers[messageObject.domain];
            if (!(messageObject.event in dispatcher)) {
                console.error("Protocol Error: Attempted to dispatch an unimplemented method '%s.%s'", messageObject.domain, messageObject.event);
                return;
            }
            dispatcher[messageObject.event].apply(dispatcher, arguments);
        }
    },
</pre>

 This method handles messsages in two ways:

* If handling a response to a backend request, it invokes a registered
  callback (line 15).

* If handling an event pushed from the backend, it delegates dispatch
  to a domain-specific dispatcher that was previously registered (line
  33).

To complete the example of `childNodeInserted` from above, we see the
entry in `Inspector.idl`:

<pre class="brush: cpp">
        [notify] void childNodeInserted(out long parentId, out long prevId, out Object node);
</pre>

Then, the message is passed to the `Inspector` domain, which is
handled by the `WebInspector` object. (This domain is special in that
its handler methods are added by other files; the following two
snippets from `DOMAgent.js` show the rest of the code path:

<pre class="brush: js">
WebInspector.childNodeInserted = function()
{
    this.domAgent._childNodeInserted.apply(this.domAgent, arguments);
}
</pre>

<pre class="brush: js">
WebInspector.DOMWindow = function(domAgent)
{
    this._domAgent = domAgent;
}

WebInspector.DOMWindow.prototype = {

    ...

    _childNodeInserted: function(parentId, prevId, payload)
    {
        var parent = this._idToDOMNode[parentId];
        var prev = this._idToDOMNode[prevId];
        var node = parent._insertChild(prev, payload);
        this._idToDOMNode[node.id] = node;
        var event = { target : node, relatedNode : parent };
        this.document._fireDomEvent("DOMNodeInserted", event);
    },

</pre>


### Enabling/disabling panels

## node-inspector Backend

TODO: how does node-inspector proxy out the backend messages?
