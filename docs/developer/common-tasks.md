# Common Development Tasks

## Adding/removing source files

### Web Inspector frontend files

TODO

### C++ headers and implementation files (WebCore/JavaScriptCore)

WebKit has many different build systems, and to add a file to all
ports, you must touch several different build files. An example
revision from WebKit trunk is
[r93918](http://trac.webkit.org/changeset/93918). In detail, these are
the files that need to be modified. Replace JavaScriptCore with the
respective framework name, as needed (e.g., WebCore or WebKit2).

__Required__:


* `Source/JavaScriptCore/CMakeLists.txt`

> Add an entry for each new .cpp file to the `JavaScriptCore_SOURCES`
> section in the correct order. 
> 
> If you add new directories containing header files, then you need to
> add that directory to `JavaScriptCore_INCLUDE_DIRECTORIES` section.

* `Source/JavaScriptCore/GNUMakefile.list.am`

> Add an entry for each .h and .cpp file, in the correct sorted
> position. The exact path style varies per file.

* `Source/JavaScriptCore/JavascriptCore.gypi`

> Add an entry to the `javascriptcore_private_header_files` section for
> any header files that should be accessible from other
> frameworks. (This distinction is a bit unclear to me.) Otherwise, add
> an entry for header and implementation files to the
> `javascriptcore_files` section.

* `Source/JavaScriptCore/JavaScriptCore.pro`

> Add an entry for each .cpp file.

* `Source/JavaScriptCore/JavaScriptCore.vcproj/JavaScriptCore/JavaScriptCore.vcproj`

> Add an entry of the form:
> 
>     <File 
>           RelativePath="..\..\heap\VTableSpectrum.cpp" 
>      > 
>      </File>

     
* `Source/JavaScriptCore/JavaScriptCore.xcodeproj/project.pbxproj`

> This file is not human-editable. 
>
>  1. Open the project in XCode, and add the new files in
>   the respective folders (called "Groups" in XCode).
>  
>  2. Still in XCode, select the top-level project icon, go to
>   "Targets > JavaScriptCore", choose the "Build Phases" pane, and
>   add the implementation and header files to "Compile Sources" and
>   "Copy Headers" lists, respectively.

__Optional__:

* `Source/JavaScriptCore/JavaScriptCore.pri`

If you add new directories containing header files, then you need to
add that directory to the `JAVASCRIPTCORE_INCLUDEPATH` variable in
this file.

* `Source/JavaScriptCore/JavaScriptCore.exp`

> If any symbols from the new code need to be exported outside of the
> framework (say, accessing JSC code from WebCore), then the mangled
> symbol name must be added to this table. __In general, you do not need
> to deal with this unless you get a linker error when compiling the
> "client" framework__.
> 
> If you delete an exported symbol's implementation and uses, make sure
> to also remove the mangled symbol name from this file. This file
> describes exported symbols, so when compiling the providing framework,
> the linker makes sure that the symbols indeed exist in the object
> files. Linking will fail if the symbol no longer exists.


### OnlineAnalyzer files

TODO
