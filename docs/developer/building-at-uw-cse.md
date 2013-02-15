# Building WebKit on UW CSE-supported machines #

<div id="generated-toc"></div>

The following instructions are for building WebKit (and Timelapse) on
UW CSE-supported Linux machines. It is organized by port.

## Building the GTK port of WebKit ##

### Dependencies ###

First you must install some software not provided by support. Install
each of these somewhere, and add them to your `PATH`
environment variable.

I recommend making a directory like `~/software/`, then adding
`--prefix $(cd ~/software && pwd)` to any `./configure`
commands. Then add `~/software/bin` to your `PATH`. If you do this, you
should also set the environment variable `PKG_CONFIG_PATH` to be
`~/software/lib/pkgconfig/` so that autotools knows that you
are installing to a non-standard prefix.

* [gperf](http://www.gnu.org/software/gperf/)

> GNU perfect hash function generator.

* [icu](http://site.icu-project.org/download/46)

> ICU internationalization software. In particular, WebKit needs the
> icu-config file, but this is one frontend to the library.
> This project is quite large and will take a while to build.

      
* [enchant](http://www.abisource.com/projects/enchant/)

> Enchant (libenchant-dev) is a C++ spell-checker library.

* [geoclue](http://www.freedesktop.org/wiki/Software/GeoClue)

> A geolocation library.

I had to manually edit `configure.am` and remove "-Werror" from
the `CFLAGS` variable. Otherwise, make will fail with warnings
about building against kernel headers in userspace. This could
probably be fixed by adding `--no-geolocation` to
the `build-webkit`, or having support install the geoclue RPM.

* [gstreamer](http://gstreamer.freedesktop.org/modules/)

> A multimedia codec library. This library is necessary to compile
> newer versions (since December 2010 or so) of WebKit. The original
> timelapse branch is older than this and does not need it.

* [gst-plugins-base](http://gstreamer.freedesktop.org/modules/)

> Some base plugins for gstreamer. The note for gstreamer also applies
> to this library.

### Starting the build ###

As for the actual building, you can run the build script as so, with
or without debug.

  ./WebKit/WebKitTools/Scripts/build-webkit --gtk --enable-debug --no-jit --timelapse

For now, `--no-jit` is required for GTK but not for the Mac
(Safari) port.  Somewhere, the controlling symbol
(`ENABLE_JIT`) is already defined, so we can't redefine it
using `--enable-jit` (the default). This is a bug, but not
worth tracking down.

This build script will call `./configure` with some options to
put the built WebKit in a sane place. Once the configuration has been
generated, you can call `make`/`make clean` in the
top-level WebKit directory.

## Building the QT Port of WebKit ##

TODO

