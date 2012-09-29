Timelapse is an experimental fork of the <a
href="http://webkit.org">WebKit project</a> that implements
interactive record/replay for web applications. Timelapse's
modifications to WebKit consist of 1) deterministic record/replay
infrastructure and 2) a new developer tool (inside Web Inspector) for
creating, browsing, and navigating through captured recordings.

Timelapse is part of ongoing research in the <a
href="http://www.cs.washington.edu">Computer Science and Engineering
department</a> of the <a href="http://www.washington.edu">University
of Washington</a>. __Instructions for building, running, and
contributing to Timelapse are on GitHub; for general information about
Timelapse-based research, <a
href="http://www.cs.washington.edu/homes/burg/timelapse/">visit the
project homepage</a>__. The <a
href="http://www.cs.washington.edu/homes/burg/projects/timelapse/faq.html">project
FAQ page</a> answers some common questions about supported browsers,
platforms, and future work.


## Getting Timelapse

### Binary Distribution

A binary version of Timelapse is created monthly, based on recent
Timelapse development and upstream changes to WebKit. You can download
the latest binary from the <a
href="https://github.com/burg/timelapse/downloads">project downloads
page</a>.

## From Source

Simply run the following from a well-connected computer:

    git clone https://github.com/burg/timelapse
    
The repository is several gigabytes in size, so it will take a long
time to clone (sorry!).

## Prerequisites

Timelapse works with recent versions of OS X and Safari. Support for
other operating systems and browsers is planned, but has not been
actively explored. The stated versions below are what we know will
work; other versions may work, but are untested.

* OS X 10.7

The following are additionally necessary to build WebKit and Timelapse:

* 4 GB of RAM (necessary to link Debug builds without dynamic paging)
* XCode 3.1.4+ or 4.3+
* git 1.7+ 

## Building, Running, Debugging

The mechanics of building, running, and debugging Timelapse are the
same as for WebKit, and described on the <a
href="http://webkit.org">WebKit project page</a>. Below are some
differences from the standard instructions.

Debug builds are started like so:

    Tools/Scripts/build-webkit --debug --timelapse
    
And release builds are started like so:
   
    Tools/Scripts/build-webkit --timelapse
    
When everything has built, you can launch a Release version of Timelapse using:

    Tools/Scripts/run-safari
    
## Contributing    
    
Timelapse is open source research, and we encourage code reuse and
contributions by others. If you have code or ideas for new features ,
send a pull request against the `timelapse` branch.

More details on contributing to Timelapse are available on the Wiki
page <a
href="https://github.com/burg/timelapse/wiki/Note-using-git-and-github">Note
using `git` and GitHub</a>.
