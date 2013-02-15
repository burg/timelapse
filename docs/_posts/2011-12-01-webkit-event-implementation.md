---
layout: post
title: How WebKit’s event model works
summary: For the most part, DOM events are synchronous. This is easy to reason about as a web programmer, but awkward to implement in on top of a highly asynchronous event loop-based UI framework and network stack. This article explains how WebKit threads the two together, and what it means for deterministic capture/replay.
---

First, here are some definitions of major parts of WebKit:

<dl>
<dt>JavaScriptCore</dt>
<dd>The JavaScript execution engine. It has no dependencies on other components.</dd>
<dt>WebCore</dt>
<dd>The page rendering/layout/event dispatching component. This
is the vast majority of the codebase in size and complexity. It
depends on JavaScriptCore (JSC). <strong>Several portions have different
implementations for each platform, such as graphics, sound, network,
user input handling, and run loop integration</strong>.
</dd>
<dt>WebKit</dt>
<dd>A fairly small layer that makes WebCore easier to embed by
exposing a higher-level interface. It depends on all of the above.</dd>
<dt>WebKit2</dt>
<dd>a more complicated split-process layer for embedding
WebKit. It depends on all of the above.</dd>
</dl>

### What controls the course of computation?

WebKit2 uses a split process model, where the Web process runs WebCore
to handle parsing, layout, rendering, and script running for one web
view. The browser/chrome process handles non-rendering tasks such as
network communications and niceties for the user, like bookmarks and
printing. The browser process communicates with all of its Web
processes via inter-process communication (IPC). Essentially, one can
view these messages as a queue of events to be handled. I’ll refer to
these events as __IPC messages__.

Occasionally during the course of rendering a page or running a
script, WebKit needs to perform (possibly a lot of) computation some
time in the future, using timer callbacks. Common uses are
implementing JavaScript timers or animations, which must run
frequently to fill in many animation frames. I’ll refer to these
callbacks as __timers__.

Timers allow asynchronous computation, and fire in a FIFO fashion:
several callbacks with the same timer interval (say, 100ms) will fire
in the order that they were registered. But, if an interval for 1s is
set immediately after an interval for 10s, the 1s timer should fire
first. This is accomplished by using a priority queue to keep track of
which timers to fire next. Intervals with less time remaining to
completion have greater priority than longer intervals. Among
intervals with the same time remaining, those registered earlier have
greater priority.

Thus, computation in WebKit is initiated by processing messages on one
of two queues:

 * Callbacks from the timer priority queue.
 * Messages from the Browser process across IPC..


### How internal timers are implemented

Periodically, all timers that are due for firing are fired
synchronously and evicted from the queue (or re-inserted, for
reoccuring timers). This periodic action is performed by a
platform-level timer, whose base class is `WebCore::SharedTimer`. Each
platform has its own event loop implementation, so each platform
defines its own
[SharedTimer](http://trac.webkit.org/browser/trunk/Source/WebCore/platform/SharedTimer.h)
subclass that hooks into native event loops. The OSX subclass of
`SharedTimer`
([SharedTimerMac](http://trac.webkit.org/browser/trunk/Source/WebCore/platform/SharedTimerMac.mm)),
for example, registers a Cocoa [CFRunLoopTimer](http://developer.apple.com/library/mac/#documentation/CoreFoundation/Reference/CFRunLoopTimerRef/Reference/reference.html). This is later called
periodically by the native event loop, which is invoked inside the
`WebKit2::RunLoop` implementation ([RunLoopMac](http://trac.webkit.org/browser/trunk/Source/WebCore/platform/RunLoopMac.mm)), which is called in the
main() method of the Web process.

The shared timer callback is registered via the following code path:
    ThreadTimers::setSharedTimer(SharedTimer* timer)
    -> MainThreadSharedTimer->setFiredFunction(ThreadTimers::sharedTimerFired)
    -> SharedTimer->setFiredFunction(void*)
    -> SharedTimerMac->setSharedTimerFiredFunction(void*)

The `SharedTimer`’s interval is continously adjusted to the interval of
the next due timer. This reduces the number of callbacks by
`SharedTimer` to `ThreadTimers::sharedTimerFired` in cases where few
timers are active (or a long ways into the future).
When it’s time for a timer to fire, the code path looks something
like:

    [NSApplication run] (native loop)
    -> timerFired()
    -> ThreadTimers::sharedTimerFired()
    -> threadGlobalData().threadTimers().sharedTimerFiredInternal()  [1]
    -> WebCore::Timer<WebCore::YourClass>->fired()

Inside of \[1\] is where eligible timers are looped over and fired, and
the `SharedTimer` interval is possibly adjusted. The gist of routine is
to fire events until none are ready to fire or we have exceeded a time
limit.

The native run loop fires lots of other native timers and callbacks,
as well. At every such point (notably in file IO, streams, networking,
and graphics), WebKit includes an implementation for each
port/platform, which may add or remove native events from the native
`RunLoop`.

### How IPC messages are handled

The Browser process sends messages to each Web process to communicate
information such as resource data, user input, window resize,
etc. These messages are piped to the Web process, which creates a
[WorkItem](http://trac.webkit.org/browser/trunk/Source/WebKit2/Platform/WorkItem.h)
for each message. These work items are queued on the native event
loop, and performed in course. In the OSX port, the
`RunLoop::performWork` method is registered as a [CFRunLoopSource](http://developer.apple.com/library/mac/#documentation/Cocoa/Conceptual/Multithreading/RunLoopManagement/RunLoopManagement.html)—-in
essence, it is registered as an additional source of events for the
event loop. The body of `performWork` copies the list of WorkItems
present upon method entry, works through the copied items, and then
returns. Note that new work items may arrive when copied ones are
being processed; these will be handled in the next call to
`performWork`. Below is a typical sequence of calls leading from the
native event loop through processing the IPC message to calling the
respective WebCore handler.

    [NSApplication run] (native event loop)
    -> RunLoopMac::performWork(void*)
    -> RunLoop::performWork()
    -> CoreIPC::Connection::dispatchMessages()
    -> CoreIPC::Connection::dispatchMessage()
    -> WebKit::WebProcess::didReceiveMessage(connection, messageID,
    arguments)
    -> WebKit::WebPage::didReceiveWebPageMessage(connection, messageId,
    arguments)
    -> CoreIPC::handleMessage(arguments, WebPageMessageReceiver, targetFn)
    -> targetFn(args...)

At the point of `targetFn`, the message can be handled in several
ways. The important thing to note is that once these handlers reach
WebCore, they are handled synchronously.

### Where do DOM events fit into this picture?

DOM events are the abstraction for event-driven programming in web
applications and JavaScript. (The [Mugshot paper](http://www.usenix.org/event/nsdi10/tech/full_papers/mickens-mugshot.pdf) has a good overview of
the DOM event model.) However, DOM events have not yet come into the
picture—-where do they originate from?

Most user input DOM events, such as clicks, scroll wheel, and
keyboard, are created in response to corresponding IPC messages. In
that case, the `targetFn` above will mediate between the native or
browser view of user input and the DOM event standards. This mediation
also converts from raw screen coordinates to a DOM target, and
excludes some events that should not be reflected into the DOM model
as input (for example, clicking on a scrollbar). Here is a typical
sequence of calls from IPC `targetFn` to DOM dispatch as described in
the above link:

    WebKit::WebPage::mouseEvent(WebMouseEvent)
    -> WebKit::handleMouseEvent(WebMouseEvent, Page)
    -> WebCore::EventHandler::dispatchMouseEvent(eventType, targetNode,
    clickCount, PlatformMouseEvent)
    -> Node::dispatchMouseEvent(...)
    -> EventDispatcher::dispatchEvent(Node, EventDispatchMediator)
    -> MouseEventDispatchMediator::dispatchEvent(EventDispatcher)
    -> EventDispatcher::dispatchEvent(Event)    // performs event dispatch according to DOM standard.
    
It is possible for some DOM events to immediately fire other DOM
events synchronously. For example, the default event handler for the
space or enter keyboard event on the &lt;input type=”submit”&gt; element
will typically fire a second DOM “submit” event on the containing
&lt;form&gt; element. This can be seen in the body and callers of
`HTMLFormElement::submitImplicitly`.
What are the important points?

The top-level event loop is usually defined by the respective WebKit
port, such as Cocoa, QT, GTK, etc. Timers internal to WebCore are
manually tracked and dispatched by a single native timer that
participates in the native run (event) loop. IPC messages are also
handled according to the native run loop, and sometimes lead to
dispatching DOM user input events. DOM events can potentially be
triggered directly by timers internal to WebCore. An example is that
animation-related DOM events are triggered by a timer in the
`AnimationController::animationTimerFired` callback. In general though,
user input is only triggered by IPC messages.
