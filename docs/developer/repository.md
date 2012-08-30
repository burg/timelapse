---
layout: info
title: Working with the Timelapse repository
---

Timelapse consists of two major components: external tools that read
and write a binary format, and a heavily-modified version of
[WebKit][]. Both of these parts, as well as documentation and the
website, live in a single mercurial repository.

## Repositories ##

The definitive repository for Timelapse is located on
[Bitbucket][]. Several auxilliary repositories are used to merge
upstream changes to WebKit. Backups of these are kept on the CSE
filesystem.

## Checking out Timelapse ##

To get a buildable version of the timelapse repository, clone the
repository with the following command:

        hg clone -b replay ssh://hg@bitbucket.org/burg/timelapse timelapse

If you have forked Timelapse on Bitbucket, then replace `burg` with
your username.

To build, consult the [build instructions]({{site.baseurl}}/developer/building.html).

## Integrating Upstream WebKit Changes ##

There are several stages: the WebKit Subversion repository must be
converted into a Mercurial repository; that repository must be
converted to match the structure of the Timelapse repository; and
finally, changes must be merged to the actual Timelapse repository.

### Part 1: Pulling Upstream Changes ###

1. Obtain a copy of the Mercurial mirror of the WebKit Subversion
   repository (henceforth, `webkit-hg-mirror`). This is available to
   CSE users at
   
        /projects/swlab1/timelapse/webkit-hg-mirror
       
   Also obtain the "upstream" mercurial repository used for merging
   with timelapse (henceforth, `webkit-hg-mirror-upstream`). This is
   available to CSE users at

        /projects/swlab1/timelapse/webkit-hg-mirror-upstream

   (NOTE: you can create a new `webkit-hg-mirror` by running the
   following commands. It is highly recommended you use an existing
   mirror though, as this step takes over 30 hours on a fast network
   and machine.)
   
        mkdir -p webkit-hg-mirror && cd !$
        hg init
        cat >> .hg/hgrc
        [paths]
        default = http://svn.webkit.org/repository/webkit/trunk
        ^D
        until hg pull; do echo; done
       
2. Pull and convert new Subversion changes into the Mercurial
   repository. You need to install and enable the [hgsubversion][]
   plugin in order to complete this step.
   
        hg pull && hg update

3. Convert new changes in the `webkit-hg-mirror` repository into the
   `webkit-hg-mirror-upstream` repository, which is suitable for
   merging with the `timelapse` repository. (In particular, WebKit is
   moved into the `./WebKit/` subdirectory of the repository, instead
   of being the root directory.) The `filemap.txt` file is kept in the
   `utils/` directory of the Timelapse repository.

        cat "rename . WebKit" > ./filemap.txt
        hg convert --filemap filemap.txt webkit-hg-mirror webkit-hg-mirror-upstream

   (NOTE: you can do this step from scratch, but it will take a very
   long time (over 30 hours) to run the first time.)

5. Pull changes from `webkit-hg-mirror-upstream` into the `timelapse`
   repository, and merge:

        cd timelapse
        hg pull -rREV -f ../webkit-hg-mirror-upstream
        hg update && hg merge

        hg ci WebKit -m "[WebKit] update WebKit from upstream to r89726 (tag: Safari-534.48.3)"

*********************************

[WebKit]: http://www.webkit.org/
[Mercurial]: http://mercurial.selenic.com/
[Bitbucket]: http://bitbucket.org/
[hgsubversion]: http://mercurial.selenic.com/wiki/HgSubversion
