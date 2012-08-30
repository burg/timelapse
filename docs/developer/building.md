---
layout: info
title: Building and Running Timelapse
---

To build Timelapse, follow the instructions on the
[official WebKit "how to build" page][WebKitBuildInstructions]. On
the command line, make sure to additionally specify
`--timelapse` so that Timelapse-specific code is compiled.

### Other dependencies

Timelapse has a runtime dependency on [Node.js][NodeJs]. You should
ensure that a recent version of Node is installed on your system and
that the `node` binary is accessible with your `$PATH` environment
variable settings.

### OS Compatibility

Timelapse is tested to work on recent versions of Mac OS X
(10.7.2+). 

Other operating systems (Linux, Windows, etc) and platforms (QT, GTK)
are not yet supported. See the [FAQ page][TimelapseFaq] for more
details.

### Browser Compatibility

Having an operating system or Safari version that's too out-of-date
may cause system interface conflicts that prevent WebKit from
building. In general, versions of Safari up to a few versions old will
still work with more recent versions of WebKit (and Timelapse).

Other browsers on OS X, such as Google Chrome, are not yet
supported. See the [FAQ page][TimelapseFaq] for more details.


### Build Tips

* The script `bin/compile-timelapse` will build the debug
  configuration of Timelapse. It ignores much of the compiler output,
  and plays a bell or beep when finished, signalling success or
  failure, respectively (OS X only).
  
* If you have only made changes to the Inspector UI, there's a
  faster way to build. Adding the
  argument `--inspector-frontend` to an invocation
  of `build-webkit` will significantly speed up
  compilation by not checking C++ and other dependencies.

## Running

To run Timelapse, from the repository root run the command
`WebKit/Tools/Scripts/run-safari --timelapse [--debug]`.
  
### Run/Debug Tips

* The scripts `bin/debug-timelapse` and `bin/run-timelapse` will
launch the Debug and Release configurations of Timelapse, if they are
built.

* The script `bin/xcode-run-and-attach` will launch a debug build, and
  automatically attach the most recent XCode project window to the
  Safari process.


**************

[NodeJs]: http://www.nodejs.org/
[TimelapseFaq]: {{site.baseurl}}/faq.html
[WebKitBuildInstructions]: http://www.webkit.org/building/build.html
