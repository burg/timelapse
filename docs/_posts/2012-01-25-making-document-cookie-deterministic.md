---
layout: post
title: Making <tt>document.cookie</tt> deterministic
summary: Cookies are a common source of website nondeterminism. Here's how Timelapse makes them deterministic during execution replay.
---

The meat of a deterministic record/replay system is finding sources of
non-determinism, and figuring out how to make them deterministic. In
order for Timelapse to replay an execution, it must find and deal with
these sources one by one. Today, I will focus on cookies in the
browser as a source of non-determinism, and how they are dealt with.

[Cookies](http://en.wikipedia.org/wiki/HTTP_cookie) are a simple
mechanism to store data across loads of a webpage. Back in the old
days, before there were
[local storage APIs](https://developer.mozilla.org/en/DOM/Storage) and
so on, this was the only mechanism to keep state on the client side in
a web application. Since the HTTP protocol is technically stateless,
web application state had to be encoded in cookie data. Information
such as authentication status or viewing preferences is often stored
this way with cookies. For obvious reasons, scripts and servers will
react to client request differently depending on the contents of the
client's cookies.

The actual form of cookies is a simple key/value pair. Along with the
key and the value, one can specify other options such as the scope of
the cookie (does it apply to only this page, or the entire domain?),
the longevity of the cookie (should it be destroyed at the end of the
browsing session, or should last a month?), and other options.

Cookies can be set in one of 2 ways: via a `Set-Cookie` header in the
response to an HTTP request, or via JavaScript, by assigning to the
`document.cookie` attribute. Similarly they can be read in one of 2
ways as well: cookies are sent with every HTTP request to the server,
and they can also be accessed by inspecting the `document.cookie`
attribute. Additionally, depending on how cookies are stored, they may
be accessible in other ways by the operating system or browser. For
example, on OS X, Safari's cookies are shared between all browser
instances, and applications that embed a
[WebView](http://developer.apple.com/library/mac/#documentation/Cocoa/Reference/WebKit/Classes/WebView_Class/Reference/Reference.html)
widget. More details of cookie headers and syntax are available at the
relevant
[Wikipedia article](http://en.wikipedia.org/wiki/HTTP_cookie#Implementation).

In the context of determinism, cookies can affect which resources are
received by the browser through HTTP requests, and they can also
affect the execution of JavaScript programs. So, for Timelapse to
re-execute properly, we need to be careful to ensure that cookies do
not alter the course of execution.

We do not actually need to worry about receiving the wrong resources
because of cookie nondeterminism, since Timelapse uses a reverse
proxy. This custom proxy exactly captures and replays the requested
resources without considering the values of cookies, cache control, or
other headers---so we need not make cookies in headers deterministic.

The `document.cookie` attribute is something to worry about, though, as
it is directly accessed by JavaScript through DOM bindings. In the
rest of this article, I'll briefly walk through how `document.cookie` is
made deterministic by Timelapse.

The easiest way to make something deterministic is by performing
intercession and memoization---in effect, a man-in-the-middle
attack---on a function that is nondeterministic. During execution
capture, the call to the nondeterministic function proceeds as normal,
and the return value is memoized before being returned to the calling
code. During execution replay, the nondeterministic function is never
called; instead, the memoized value is used. This simple "trick" works
well for well-scoped, function-like nondeterminism such as
`Math.random`, `Date.now()`, and importantly, `document.cookie`.

At runtime, `document.cookie` will return all of the cookies active
for the webpage. A typical output may look like this (without line breaks)
    MintUnique=1;
    __utma=226301839.1210538346.1312079161.1317059721.1327433486.4;
    __utmz=226301839.1317059721.3.3.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=markdown%20plus%20html;
    MintAcceptsCookies=1;
    __utmb=226301839.1.10.1327433486;
    __utmc=226301839;
    MintUniqueHour=1327431600;
    MintUniqueDay=1327381200;
    MintUniqueWeek=1327208400;
    MintUniqueMonth=1325394000
 Since the output is just a string, it should be easy to save during
 capture and inject during replay. The only trick left is figuring out
 where to play "man-in-the-middle".
 
The `cookie` attribute is defined by the DOM standard, which specifies
the methods and attributes of the `document` object. In WebKit, these
attributes and methods are implemented in C++, but are accessible to
JavaScript programs. The glue code that allows JavaScript (or
Objective C, or other languages) to call C++ functions is referred to
as the DOM bindings. This glue code is automatically generated by Perl
scripts according to specifications written in the
[WebIDL](http://www.w3.org/TR/WebIDL/) language. The IDL files are
usually located alongside the C++ classes that implement them. For
example,
[Document.idl](http://trac.webkit.org/browser/trunk/Source/WebCore/dom/Document.idl)
can be found in the
[Source/WebCore/dom/](http://trac.webkit.org/browser/trunk/Source/WebCore/dom/)
directory.

For cookies, the relevant section of Document.idl is:
    attribute \[ConvertNullToNullString\] DOMString cookie
        setter raises (DOMException),
        getter raises (DOMException);
This defines an attribute (like a field) of type `DOMString`, named
cookie. Attributes can have special properties: in this case,
`ConvertNullToNullString` tells the glue code generator to insert a
specific conversion on the return value. The `getter` and `setter`
meta-attributes allow one to independently specify the behavior of
getting and setting the `cookie` attribute. In this case, it is
specified that these can raise DOM exceptions.

We would like to change the behavior of `getter`, so that it performs
man-in-the-middle activities. Fortunately, there exists a special
property that lets us manually define the glue code for a particular
method, getter, or setter. The modified version (with header guards)
looks like so:

    #if defined(ENABLE_TIMELAPSE) && ENABLE_TIMELAPSE
        // our custom getter implements ConvertNullToNullString
        attribute [CustomGetter] DOMString cookie 
    #else
        attribute [ConvertNullToNullString] DOMString cookie
    #endif
            getter raises (DOMException),
            setter raises (DOMException);

The `CustomGetter` property instructs the glue code generator to
output just a header (not an implementation!) for the getter. Then, we
must write our own getter binding. Custom bindings are located in
[Source/WebCore/bindings/js/](http://trac.webkit.org/browser/trunk/Source/WebCore/bindings/js/)
in the WebKit repository, named the same as their IDL files but with
"Custom" appended to the name. We then add the custom binding to the
file, guarded once again by `ENABLE_TIMELAPSE` (which is controlled by
a build flag for Timelapse support):

{% highlight cpp %}
#if ENABLE(TIMELAPSE)
// A custom document.cookie binding that handles Timelapse memoization.
JSValue JSDocument::cookie(ExecState* exec)
{
    String cookie;
    ExceptionCode ec = 0;
    JSGlobalObject* globalObject = exec->lexicalGlobalObject();

    if (RefPtr<DeterminismLog> log = globalObject->determinismLog()) {
        if (log->capturing()) {
            cookie = impl()->cookie(ec);
            log->append(new GetDocumentCookie(cookie, ec));
        } else if (log->replaying()) {
            GetDocumentCookie* action = static_cast<GetDocumentCookie*>(log->currentAction(ReplayableTypes::GetDocumentCookie));
            cookie = action->cookie();
            ec = action->exceptionCode();
        }
    } else {
        //if no determinism, obtain the normal way.
        cookie = impl()->cookie(ec);
    }
    //convert and send the cookie result to JS-land
    JSC::JSValue result = jsString(exec, cookie);
    setDOMException(exec, ec);
    return result;
}    
#endif
{% endhighlight %}

The important part to note is that we either save the `cookie` and
`ec` (exception code) before returning, or pull out those values from
the recorded log and return those. And, corresponding with the ifdefs
in the IDL file, we only want to compile this symbol when
`ENABLE_TIMELAPSE` is true. Otherwise, the glue code generator will
create a method with the exact same signature, but without any
determinism-related code, causing the linker to fail.
 
