# WebCore Internals

## Loading Resources

### Code path for scheduling/requesting a subresource

<pre>
DocumentThreadableLoader::loadRequest(ResourceRequest&, SecurityCheckPolicy)
  ResourceLoadScheduler::scheduleSubresourceLoad(...)
    SubResourceLoader::create();
    ResourceLoadScheduler::scheduleLoad(ResourceLoader*, Priority)
      HostInformation host = hostForURL(...);
      host->schedule(resourceLoader, priority)
        m_requestsPending[priority].append(resourceLoader);
      servePendingRequests(host, priority)
        for (i=high..low prio) {
          while (requests of priority i remain)
            if (shouldLimit) return;
            resourceLoader->start(); 
or
      scheduleServePendingRequests();
        m_requestTimer.startOneShot(0);
          ... //asynchronous callback
          servePendingRequests();
</pre>

<pre>
ResourceLoader::start()
  ResourceLoader::willSendRequest(ResourceRequest&, ResourceResponse)
    identifier = m_frame->page()->progress()->createUniqueIdentifier();
    frameLoader()->notifier()->assignIdentifierToInitialRequest(identifier, documentLoader(), request);
    //other notifications down the chain...
  ResourceHandle::create()
    ResourceHandle::start()
      //platform specific creation of network connection, send request
</pre>

<style type="text/css">
@import url(../css/style.css);
@import url(../css/shCore.css);
@import url(../css/shThemeDefault.css);
</style>

<script type="text/javascript" src="../js/shCore.js"></script>
<script type="text/javascript" src="../js/shBrushJScript.js"></script>
<script type="text/javascript" src="../js/shBrushCpp.js"></script>
<script type="text/javascript">
     SyntaxHighlighter.all()
</script>
