/*
 *  Copyright (C) 2011, 2012 Brian Burg.
 *  Copyright (C) 2011, 2012 University of Washington. All rights reserved.
 *
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of the University of Washington nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"

#if ENABLE(TIMELAPSE)

#include "DeterminismController.h"

#include "AsyncEventProxy.h"
#include "CacheController.h"
#include "DisableCache.h"
#include "DocumentEventQueue.h"
#include "DocumentLoader.h"
#include "DOMWindow.h"
#include "DOMWrapperWorld.h"
#include "EnableCache.h"
#include "Event.h"
#include "Frame.h"
#include "FrameTree.h"
#include "JSONActionSerializer.h"
#include "InitializeFocus.h"
#include "InitializeWindow.h"
#include "InspectorInstrumentation.h"
#include "KURL.h"
#include "Location.h"
#include "Logging.h"
#include "MouseEvent.h"
#include "NavigateToPage.h"
#include "NetworkProxy.h"
#include "Node.h"
#include "Page.h"
#include "ResourceResponse.h"
#include "RanPendingScripts.h"
#include "SecurityOrigin.h"
#include "SentinelActions.h"
#include "Timer.h"
#include "TimerFired.h"
#include "UserInputProxy.h"
#include <stdarg.h>
#include <wtf/timelapse/DeterminismLog.h>
#include <wtf/timelapse/ReplayableAction.h>

namespace WebCore {

static DispatchableAction* popDispatchAction(PassRefPtr<DeterminismLog> log)
{
        ReplayableAction* poppedAction = log->popAction(WTF::DispatchableActionQueue);
        ASSERT(poppedAction);
        return static_cast<DispatchableAction*>(poppedAction);
}

#if !LOG_DISABLED
static void dumpEventDispatchInfo(const Event& event, DOMWindow* window, Node* node, int eventCount, bool wasIgnored)
{
    if (node)
        LOG(Timelapse, "%-30s %s DOM event %4d@: type=%s, target=%d/node[%p] %s\n", "[DeterminismController]",
            (wasIgnored) ? "Unrelated" : "Dispatching",
            eventCount,
            event.type().string().utf8().data(),
            SerializedEventTarget::frameIndexFromDocument((node->inDocument()) ? node->document() : node->ownerDocument()),
            (void*)node,
            node->nodeName().utf8().data());

    else if (window)
        LOG(Timelapse, "%-30s %s event %4d@: type=%s, target=%d/window[%p] %s\n", "[DeterminismController]",
            (wasIgnored) ? "Unrelated" : "Dispatching",
            eventCount,
            event.type().string().utf8().data(),
            SerializedEventTarget::frameIndexFromDocument(window->document()),
            (void*)window,
            window->location()->href().utf8().data());
}
#endif // !LOG_DISABLED

#ifndef NDEBUG
static bool debugHookOnDomEvents(const Event& event)
{
    if (event.type() == eventNames().beforeunloadEvent)
        return false;
    if (event.type() == eventNames().blurEvent)
        return false;
    if (event.type() == eventNames().clickEvent)
        return false;
    if (event.type() == eventNames().dblclickEvent)
        return false;
    // DOMContentLoaded is fired by the default event handler for the main document's loadEvent.
    if (event.type() == eventNames().DOMContentLoadedEvent)
        return false;
    if (event.type() == eventNames().errorEvent)
        return false;
    if (event.type() == eventNames().focusEvent)
        return false;                
    if (event.type() == eventNames().keydownEvent)
        return false;
    if (event.type() == eventNames().keypressEvent)
        return false;
    if (event.type() == eventNames().keyupEvent)
        return false;
    if (event.type() == eventNames().loadEvent)
        return false;
    if (event.type() == eventNames().mousedownEvent)
        return false;
    if (event.type() == eventNames().mousemoveEvent)
        return false;
    if (event.type() == eventNames().mouseoutEvent)
        return false;
    if (event.type() == eventNames().mouseoverEvent)
        return false;
    if (event.type() == eventNames().mouseupEvent)
        return false;
    if (event.type() == eventNames().mousewheelEvent)
        return false;
    // pagehide is fired by Document::implicitClose() (I think)
    if (event.type() == eventNames().pagehideEvent)
        return false;
    if (event.type() == eventNames().readystatechangeEvent)
        return false;
    if (event.type() == eventNames().pageshowEvent)
        return false;
    if (event.type() == eventNames().popstateEvent)
        return false;
    if (event.type() == eventNames().selectEvent)
        return false;
    // selectionchangeEvents are kicked off by mouse events, which
    // enqueue selectionchange into the DocumentEventQueue. (enqueued
    // by FrameSelection::setSelection).
    if (event.type() == eventNames().selectionchangeEvent)
        return false;    
    if (event.type() == eventNames().selectstartEvent)
        return false;
    if (event.type() == eventNames().unloadEvent)
        return false;

    return false;
}
#endif // !NDEBUG


DeterminismController::DeterminismController(Page* page)
    : m_page(page)
    , m_timer(this, &DeterminismController::timerFired)
    , m_determinismLog(0)
    , m_cacheController(adoptRef(new CacheController()))
    , m_previousAction(0)
    , m_waitingAction(0)
    , m_runningAction(0)
    , m_dispatching(false)
    , m_domEventDispatchDepth(0)
    , m_domEventDispatchCount(0)
    , m_domEventRemainingQuota(0)
    , m_status(CannotReplay)
    , m_replayMode(FullSpeed)
    , m_errorStrategy(PauseOnError)
    , m_currentMark(0)
    , m_stopBeforeMarkIndex(0)
    , m_previousActionDispatchStartTime(0.0)
    , m_previousMarkTime(0.0) { }

DeterminismController::~DeterminismController()
{
}
    
//-- capture controls
    
void DeterminismController::beginCapturing(const PositionMark& mark)
{
    ASSERT(!capturing());
    
    if (replaying())
        cancelPlayback();
        
    m_status = CannotReplay;
    m_domEventDispatchCount = 0;
    m_previousAction = 0;
    m_determinismLog = DeterminismLog::createLogForCapture();
    changeProxyMode(TimelapseProxy::Capturing);

    InspectorInstrumentation::captureStarted(m_page);
    
    // create begin sentinel
    captureAction(new BeginSentinel(m_domEventDispatchCount, mark));

    m_cacheController->disableCache();
    captureAction(new DisableCache(m_domEventDispatchCount, m_currentMark));
    captureAction(new InitializeFocus(m_page, m_domEventDispatchCount, m_currentMark));
    captureAction(new InitializeWindow(m_page, m_domEventDispatchCount, m_currentMark));
    // attempt to pull reasonable values here to save in the log, and 
    // also to use for the initial refresh.
    Frame* mainFrame = m_page->mainFrame();
    NavigateToPage* reloadAction = new NavigateToPage(mainFrame->document()->securityOrigin(),
                                                      mainFrame->document()->url().string(),
                                                      mainFrame->loader()->referrer(),
                                                      m_domEventDispatchCount, m_currentMark);
    captureAction(reloadAction);

    //The call to scheduleLocationChange should be the same on capture and replay.
    setExpectsPageLoad(true);
    // TODO: right now, the last two args make this page load count in the BFCache
    // and the history. Is this a bad idea? They are not counted during replays.
    mainFrame->navigationScheduler()->scheduleLocationChange(reloadAction->securityOrigin().get(),
                                                             reloadAction->url(),
                                                             reloadAction->referrer(),
                                                             false, false);
}

bool DeterminismController::endCapturing(const PositionMark& mark)
{
    // this protects against receiving stopRecording commands twice before
    // the UI is notified that recording is stopped (which disables that command).
    if (!capturing()) {
        LOG(Timelapse, "%-30sIgnored request to stop recording; not in a valid state to do so.\n", "[DeterminismController]");
        return false;
    }

    LOG(Timelapse, "%-30sEnding capture.\n", "[DeterminismController]");

    captureAction(new EnableCache(m_domEventDispatchCount, mark));
    captureAction(new EndSentinel(m_domEventDispatchCount, mark));
    //normally performed by captureAction (called on following action), but this is last action.
    finalizePreviousAction(m_domEventDispatchCount);

    m_determinismLog->endCapturing();
    
    serialize();

    // unsets "recording page events" and unplugs the determinism log from global object.
    resetPlayback();

    m_cacheController->enableCache();
    changeProxyMode(TimelapseProxy::Open);
    
    //now replay is possible, but requires a reset.
    m_status = PlaybackUninitialized;
    InspectorInstrumentation::captureFinished(m_page);
    return true;
}

//-- replay API

void DeterminismController::pauseAtNextMark()
{
    ASSERT(replaying());

    if (m_status == ReplayToCompletion)
        m_status = ReplayUpToMarkIndex;

    if (m_status == ReplayUpToMarkIndex) {
        // finish all actions with the current mark index. This will cause a pause when
        // a dispatchable action with different index comes up.
        m_stopBeforeMarkIndex = m_currentMark.index() + 1;
    }
}

void DeterminismController::replayUpToMarkIndex(PositionMarkIndex index, ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(Timelapse, "%-30s About to begin replay to mark %d.\n", "[DeterminismController]", index);

    // only undone by recording, or cancelling playback.
    changeProxyMode(TimelapseProxy::Replaying);

    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished || index < m_currentMark.index())
        resetPlayback();

    m_status = ReplayUpToMarkIndex;
    m_stopBeforeMarkIndex = index;
    m_replayMode = mode;

    InspectorInstrumentation::playbackStarted(m_page);
    maybeDispatchAction();
}

void DeterminismController::replayToCompletion(ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(Timelapse, "%-30s About to begin replay to completion.\n", "[DeterminismController]");

    // only undone by recording, or cancelling playback.
    changeProxyMode(TimelapseProxy::Replaying);

    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished)
        resetPlayback();

    m_replayMode = mode;
    m_status = ReplayToCompletion;
    InspectorInstrumentation::playbackStarted(m_page);
    maybeDispatchAction();
}

    
void DeterminismController::cancelPlayback()
{
    switch (m_status) {
        case CannotReplay:
        case PlaybackUninitialized:
            ASSERT_NOT_REACHED();
            break;

        /* from here, we intentionally fall through the cases. Depending on the current state, we
           need to perform some or all of the following transitions to cancel gracefully:
         
            running --> paused --> finished --> cancelled 
        */   
        case ReplayToStart:
        case ReplayUpToMarkIndex:
        case ReplayToCompletion:
        case PlaybackResetting:
            // this cancels any pending timers, and fires instrumentation.
            pauseReplay(m_currentMark.index());
            
        case PlaybackPaused:
            // this disconnects the determinism log from global object, and fires instrumentation.
            finishReplay();
                
        case PlaybackFinished:
            changeProxyMode(TimelapseProxy::Open);
            InspectorInstrumentation::playbackCancelled(m_page);
    }

}
    
//-- external callbacks    

void DeterminismController::willDispatchEvent(const Event& event, DOMWindow* window, Node* node, const PositionMark&)
{
    bool shouldIgnore = !window || (!isCapturingDocument(window->document()) &&
                                    !isReplayingDocument(window->document()));

    m_domEventDispatchDepth++;
#if !LOG_DISABLED
    dumpEventDispatchInfo(event, window, node, m_domEventDispatchCount, shouldIgnore);
#else
    UNUSED_PARAM(event);
    UNUSED_PARAM(window);
    UNUSED_PARAM(node);
#endif // !LOG_DISABLED

    if (shouldIgnore)
        return;

#ifndef NDEBUG
    // this is only used to break on specific event types.
    debugHookOnDomEvents(event);
#endif // !defined(NDEBUG)

    // finally, increment the dispatch count before the actual dispatch occurs.
    m_domEventDispatchCount++;
    m_domEventRemainingQuota--;

    // this could be extracted as "maybeInjectInputs()"
    if (replaying() && m_domEventRemainingQuota < 0) {
        if (m_timer.isActive()) {
            //fire the timer early to try and inject the next event before the "willDispatchEvent" event happens.
            m_timer.stop();
            syncDispatchAction();
        } else {
            // This usually indicates nondeterministic APIs, or reordering of dispatchable inputs and DOM events.
            String errorMessage = String::format("more DOM events were dispatched (%d) than expected (%d) before the next input.", m_runningAction->DOMEventQuota(), m_runningAction->DOMEventQuota()-1);
            playbackError(false, errorMessage);
        }
    }
}
    
void DeterminismController::didDispatchEvent()
{
    m_domEventDispatchDepth--;

    if (replaying())
        maybeDispatchAction();
}

void DeterminismController::frameNavigated(DocumentLoader* loader, const PositionMark&)
{
    if (!capturing() && !replaying())
        return;
    
    setExpectsPageLoad(false);
    loader->frame()->script()->globalObject(mainThreadNormalWorld())->configureDeterminism(m_determinismLog);
}

void DeterminismController::willFireTimer(int timerId, Frame* frame, const PositionMark& mark)
{
    if (isCapturingDocument(frame->document()))
        captureAction(new TimerFired(timerId, frame->document(), m_domEventDispatchCount, mark));
}

void DeterminismController::willRunPendingScriptsForDocument(Document* document) {
    if (isCapturingDocument(document))
        captureAction(new RanPendingScripts(document));
}

//-- accessors
PassRefPtr<CacheController> DeterminismController::cacheController() const
{
    return m_cacheController;
}

PassRefPtr<DeterminismLog> DeterminismController::determinismLog() const
{
    return m_determinismLog;
}
    
bool DeterminismController::isCapturingDocument(Document* document) const
{
    if (!capturing() || !document)
        return false;
    
    JSDOMWindow* window = toJSDOMWindow(document->frame(), mainThreadNormalWorld());
    return window && window->determinismLog() && 
           window->determinismLog()->isActive() && window->determinismLog()->capturing();
}

bool DeterminismController::isReplayingDocument(Document* document) const
{
    if (!replaying() || !document)
        return false;
    
    JSDOMWindow* window = toJSDOMWindow(document->frame(), mainThreadNormalWorld());
    return window && window->determinismLog() &&
           window->determinismLog()->isActive() && window->determinismLog()->replaying();
}

void DeterminismController::capturePageInput(DispatchableAction* action)
{
    if (!capturing())
        return;

    // flush document event queue, so event dispatch count reflects anything 
    // dispatched or queued before this action was captured.
    m_page->mainFrame()->document()->eventQueue()->flush();
    captureAction(action);
    InspectorInstrumentation::capturedPageInput(m_page, action);
}

bool DeterminismController::playbackError(bool isFatal, const String& errorMessage)
{
    ASSERT(replaying());

    LOG(Timelapse, "%-30s %sPlayback error: %s", "[DeterminismController]",
        isFatal ? "FATAL " : "",
        errorMessage.utf8().data());
    
    if (isFatal) {
        LOG(Timelapse, "%-30s Terminating playback due to fatal error.", "[DeterminismController]");
        cancelPlayback();
        InspectorInstrumentation::playbackError(m_page, true, errorMessage);
        return true;
    }
    
    if (m_errorStrategy == ContinueOnError) {
        LOG(Timelapse, "%-30s Continuing past non-fatal error.", "[DeterminismController]");
    } else {
        LOG(Timelapse, "%-30s Reporting and pausing because of non-fatal error.", "[DeterminismController]");
        pauseReplay(m_currentMark.index());
        InspectorInstrumentation::playbackError(m_page, isFatal, errorMessage);
    }
    
    return m_errorStrategy == PauseOnError;
}

// Private methods

void DeterminismController::captureAction(DispatchableAction* action)
{
    ASSERT(capturing());
    
    action->setDispatchCount(m_domEventDispatchCount);
    finalizePreviousAction(action->dispatchCount());

    m_currentMark = action->mark();
    m_determinismLog->append(action);
    m_previousAction = action;
}

void DeterminismController::finalizePreviousAction(int currentDispatchCount)
{
    ASSERT(capturing());
    if (m_previousAction) {
        unsigned eventQuota = currentDispatchCount - m_previousAction->dispatchCount();
        m_previousAction->setDOMEventQuota(eventQuota);
        m_previousAction->seal();
    }
}

void DeterminismController::didDispatch(DispatchableAction* action)
{
    ASSERT(replaying());
    if (!m_runningAction) {
        LOG(Timelapse, "%-30s Clearing pending didDispatch flag, since it appears replay stopped while processing this event (i.e., inside a debugger's inner event loop, or because of a fatal replay error)\n", "DeterminismController");
        return;
    }
    ASSERT(m_dispatching);
    ASSERT(action == m_runningAction);
#ifdef NDEBUG
    UNUSED_PARAM(action);
#endif // !defined(NDEBUG)

    InspectorInstrumentation::playbackHitMark(m_page, m_runningAction->mark().index());
    m_runningAction = 0;
    m_dispatching = false;

    if (m_status == PlaybackPaused)
        return;

    // if the expected input never came, just forget we were expecting it.
    // it may have been consumed by another instrumenting agent.
    maybeDispatchAction();
}

void DeterminismController::maybeDispatchAction()
{
    ASSERT(replaying());

    // if something is already in the midst of being replayed, then do nothing.
    if (m_runningAction)
        return;

    // if there was an error between now the previous dispatch, report it now.
    if (m_determinismLog->hasError()) {
        // TODO: some of these should be recoverable, but for now they are all fatal.
        // we must clear the error
        playbackError(true, m_determinismLog->errorMessage());
        return;
    }

    // if there is no waiting action, then get one.
    if (!m_waitingAction)
        m_waitingAction = popDispatchAction(m_determinismLog);

    m_currentMark = m_waitingAction->mark();
    
    // if running the waiting action would proceed past the desired mark, pause.
    if ((m_status == ReplayUpToMarkIndex && m_stopBeforeMarkIndex == m_currentMark.index())
        || m_status == ReplayToStart) {
        pauseReplay(m_stopBeforeMarkIndex);
        return;
    }

    if (m_waitingAction->type() == ReplayableTypes::EndSentinel) {
        finishReplay();
        return;
    }
    
    //if this event is overdue, then the replay has diverged (probably caused by user interaction)
    if (m_waitingAction->dispatchCounted() && m_waitingAction->dispatchCount() < m_domEventDispatchCount) {
        String errorMessage = String::format("Next action should be injected after %d retired DOM events, but %d DOM events have retired.",
                                             m_waitingAction->dispatchCount(), 
                                             m_domEventDispatchCount);

        if (playbackError(false, errorMessage))
            return;
    }
    
    //if this event is next in line or overdue, promote it to "running", then fire immediately.
    if (!m_waitingAction->dispatchCounted() || m_waitingAction->dispatchCount() <= m_domEventDispatchCount) {
        m_runningAction = m_waitingAction;
        m_waitingAction = 0;
        asyncDispatchAction();
    }

    //otherwise, it will be considered for dispatch after every future event.
    else
        LOG(Timelapse, "%-30s Waiting to dispatch next action (current: %d@; target: %d@).\n",
            "[DeterminismController]", m_domEventDispatchCount, m_waitingAction->dispatchCount());
}

void DeterminismController::timerFired(Timer<DeterminismController>*)
{
    syncDispatchAction();
}

void DeterminismController::asyncDispatchAction()
{
    ASSERT(m_runningAction);
    ASSERT(replaying());

    if (m_timer.isActive())
        m_timer.stop();

    switch (m_replayMode) {
    case FullSpeed:
        // delay 1ms so will happen after 0ms delay timers fire
        m_timer.startOneShot(1.0 * 0.001);
        break;

    case Realtime: {
        // The goal is to reproduce the delay between dispatched events that
        // was observed during the recording. So, we need to compute how much time
        // to wait such that the elapsed time (since previous dispatch) plus the wait
        // time (until next dispatch) will equal the observed delay between the
        // previous and current event.

        // sometimes, the previous mark time isn't set for some reason.
        if (m_previousMarkTime == 0.0)
            m_previousMarkTime = m_runningAction->mark().time();

        double targetInterval = m_runningAction->mark().time() - m_previousMarkTime;
        double elapsed = monotonicallyIncreasingTime() - m_previousActionDispatchStartTime;
        double waitInterval = targetInterval - elapsed;

        // a negative wait time means that dispatch took longer on replay than on
        // capture. In this case, proceed without waiting at all (subject to
        // the nonzero interval condition as in the FullSpeed replay mode).
        if (waitInterval < 0.0)
            waitInterval = (1.0 * 0.001);

        LOG(Timelapse, "%-30s WAIT: %.3f ms", "[DeterminismController]", waitInterval*1000.0);
        
        if (waitInterval > 1000.0) {
            LOG_ERROR("%-30s ERROR: tried to wait for over 1000 seconds; this is probably a bug.",
                      "[DeterminismController]");
            waitInterval = 1.0 * 0.001;
        }
        
        m_timer.startOneShot(waitInterval);
        break;
    }
    }
}

void DeterminismController::syncDispatchAction()
{
    ASSERT(replaying() && m_runningAction);

    // flush document event queue before dispatching our own events.
    m_page->mainFrame()->document()->eventQueue()->flush();

    if (m_replayMode == Realtime) {
        m_previousActionDispatchStartTime = monotonicallyIncreasingTime();
        m_previousMarkTime = m_runningAction->mark().time();
    }
    m_domEventRemainingQuota = m_runningAction->DOMEventQuota();
    LOG(Timelapse, "%-30s ----------------------------------------------",
                   "[DeterminismController");
    LOG(Timelapse, "%-30s DISPATCH: %s\n", "[DeterminismController]",
                   m_runningAction->toString().utf8().data());
    m_dispatching = true;
    m_runningAction->dispatch(this);
}
        

void DeterminismController::resetPlayback()
{
    LOG(Timelapse, "%-30s Resetting the replay log...\n", "[DeterminismController]");

    //unplug determinism log from all global objects in this Page.
    for (Frame* frame = m_page->mainFrame(); frame; frame = frame->tree()->traverseNext())
        frame->script()->globalObject(mainThreadNormalWorld())->configureDeterminism(0);
    
    m_waitingAction = 0;
    m_runningAction = 0;
    m_domEventDispatchCount = 0;
    m_currentMark = 0;
    m_previousMarkTime = 0.0;
    m_previousActionDispatchStartTime = 0.0;
    m_determinismLog->reset();
}

void DeterminismController::pauseReplay(PositionMarkIndex index)
{
    if (m_timer.isActive())
        m_timer.stop();
    
    m_status = PlaybackPaused;
    InspectorInstrumentation::playbackPaused(m_page, index);
}

void DeterminismController::finishReplay()
{
    m_status = PlaybackFinished;
    
    // unplug the determinismLog from JS global object so we don't accidentally 
    // try to pull events from it. Such attempts will fail, since the log is at the end.
    resetPlayback();
    InspectorInstrumentation::playbackFinished(m_page);
}

void DeterminismController::serialize()
{
    LOG(Timelapse, "%-30sMETRIC: memory overhead: %zu bytes\n", "[DeterminismController]", m_determinismLog->memorySize());

    JSONActionSerializer* serializer = new JSONActionSerializer(m_determinismLog);
    FILE* file;
    const char* filename = getenv("TIMELAPSE_SERIALIZED_RECORDING_FILENAME");
    if (filename) {
        file = fopen(filename, "w");
        if (!file)
            fprintf(stderr, "Warning: Could not open log file %s for writing.\n", filename);
    }
    if (!file)
        file = stderr;

    LOG(Timelapse, "%-30sMETRIC: dumping serialized recording to %s\n", "[DeterminismController]", filename);

    serializer->serializeToFile(file);
    fclose(file);
}

void DeterminismController::changeProxyMode(TimelapseProxy::ProxyMode mode)
{
    m_page->userInputProxy()->setProxyMode(mode);
    m_page->asyncEventProxy()->setProxyMode(mode);
    m_page->networkProxy()->setProxyMode(mode);
}

bool DeterminismController::capturing() const
{
    return m_status == CannotReplay && m_determinismLog &&
           m_determinismLog->isActive() && m_determinismLog->capturing();
}

bool DeterminismController::replaying() const
{
    return m_status != CannotReplay && m_status != PlaybackUninitialized &&
           m_determinismLog && m_determinismLog->isActive() && m_determinismLog->replaying();
}
        
}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
