Timelapse is an experimental fork of the [WebKit project](http://webkit.org) that implements
interactive record/replay for web applications. At a high level, Timelapse adds 1) a deterministic record/replay
infrastructure and 2) a new developer tool (inside Web Inspector) for
creating, browsing, and navigating through captured recordings. For more details, visit the wiki page [Changes from Vanilla WebKit](https://github.com/burg/timelapse/wiki/Changes-from-Vanilla-WebKit).

Timelapse is part of ongoing research in the [Computer Science and Engineering](http://www.cs.washington.edu)
department of the [University
of Washington](http://www.washington.edu). The [project FAQ page](https://github.com/burg/timelapse/wiki/Frequently-asked-questions) answers some common questions about supported browsers,
platforms, and future work.


## How to Install

Binary and source builds are only tested on Mac OS X 10.7+ and won't work on other WebKit ports yet (QT, GTK, EFL, Win, etc). (Want to fix that? see [Future Project Ideas](https://github.com/burg/timelapse/wiki/Project-Ideas#project-turn-on-enableweb_replay-for-other-ports-qt-gtk-and-platforms-windows-linux)).

### Binary Distribution

A Timelapse-enabled WebKit binary build is created irregularly, based on recent Timelapse development and upstream changes to WebKit. You can find a link to the latest binary on the [project wiki](https://github.com/burg/timelapse/wiki).

### From Source

Timelapse has the following build requirements (on OS X): 

* 4 GB of RAM
* XCode 4.6+
* git 1.7+ 

If you are familiar with git and GitHub, you can run the following commands and wait a while (the repository is several gigabytes in size).

```
mkdir -p ~/repos/timelapse/ && cd ~/repos/timelapse/
git init
git remote add upstream git://git.webkit.org/WebKit.git
git remote add github https://github.com/burg/timelapse.git
git fetch upstream master:upstream
git fetch github timelapse:timelapse
git checkout timelapse
```

Otherwise, see [Note getting started developing Timelapse](https://github.com/burg/timelapse/wiki/Note-getting-started-developing-Timelapse) for more detailed instructions.

## Building, Running, Debugging

For binary builds, Timelapse will be available when you launch Safari by clicking on the nightly .app.

For source builds, Timelapse integrates with the WebKit build system, and is enabled by specifying the `--web-replay` feature flag.

Debug builds are started like so:

    Tools/Scripts/build-webkit --debug --web-replay
   
And release builds are started like so:
   
    Tools/Scripts/build-webkit --web-replay
   
When everything has built, you can launch a Release version of Timelapse using:

    Tools/Scripts/run-safari

## Contributing    
   
Timelapse is open source research, and we encourage code reuse and
contributions by others. If you have code or ideas for new features,
send a pull request against the `timelapse` branch.

More details on contributing to Timelapse are available on the Wiki
page [Note
using `git` and GitHub](https://github.com/burg/timelapse/wiki/Note-using-git-and-github).

## Roadmap and Project Ideas

* [Details on upstreaming Timelapse to WebKit trunk](https://github.com/burg/timelapse/wiki/Plans-for-upstreaming)
* [Project ideas for enhancing Timelapse](https://github.com/burg/timelapse/wiki/Project-Ideas)

For details on the research roadmap, look on the wiki.
