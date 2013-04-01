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

#include "ReplayController.h"

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
#include "JSONReplayInputSerializer.h"
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
#include "ReplayRecording.h"
#include "ResourceResponse.h"
#include "RanPendingScripts.h"
#include "SecurityOrigin.h"
#include "SentinelActions.h"
#include "Timer.h"
#include "TimerFired.h"
#include "UserInputProxy.h"
#include <stdarg.h>
#include <wtf/replay/ReplayInputLog.h>
#include <wtf/replay/NondeterministicInput.h>

namespace WebCore {

static EventLoopInput* popDispatchInput(ReplayInputLog* log)
{
    NondeterministicInput* poppedInput = log->popInput(WTF::EventLoopInputQueue);
    ASSERT(poppedInput);
    return static_cast<EventLoopInput*>(poppedInput);
}

static void unplugInputLogFromPage(Page* page)
{
    //unplug determinism log from all global objects in this Page.
    for (Frame* frame = page->mainFrame(); frame; frame = frame->tree()->traverseNext())
        frame->script()->globalObject(mainThreadNormalWorld())->setReplayInputLog(0);
}

#if !LOG_DISABLED
static void dumpEventDispatchInfo(const Event& event, DOMWindow* window, Node* node, int eventCount, bool wasIgnored)
{
    if (node)
        LOG(DeterministicReplay, "%-30s %s DOM event %4d@: type=%s, target=%d/node[%p] %s\n", "[ReplayController]",
            (wasIgnored) ? "Unrelated" : "Dispatching",
            eventCount,
            event.type().string().utf8().data(),
            SerializedEventTarget::frameIndexFromDocument((node->inDocument()) ? node->document() : node->ownerDocument()),
            (void*)node,
            node->nodeName().utf8().data());

    else if (window)
        LOG(DeterministicReplay, "%-30s %s event %4d@: type=%s, target=%d/window[%p] %s\n", "[ReplayController]",
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


ReplayController::ReplayController(Page* page)
    : m_page(page)
    , m_nextRecordingId(1)
    , m_loadedRecording(0)
    , m_timer(this, &ReplayController::timerFired)
    , m_cacheController(adoptRef(new CacheController()))
    , m_previousInput(0)
    , m_waitingInput(0)
    , m_runningInput(0)
    , m_dispatching(false)
    , m_domEventDispatchDepth(0)
    , m_domEventDispatchCount(0)
    , m_domEventRemainingQuota(0)
    , m_status(CannotReplay)
    , m_replayMode(FullSpeed)
    , m_errorStrategy(PauseOnError)
    , m_currentMark(0)
    , m_stopBeforeMarkIndex(0)
    , m_previousDispatchStartTime(0.0)
    , m_previousMarkTime(0.0) { }

ReplayController::~ReplayController()
{
}
    
//-- capture controls
    
void ReplayController::beginCapturing(const PositionMark& mark)
{
    if (m_loadedRecording) {
        LOG_ERROR("Tried to begin capturing a replay recording, but another recording is still loaded.");
        cancelPlayback();
        return;
    }
        
    m_status = CannotReplay;
    m_domEventDispatchCount = 0;
    m_previousInput = 0;
    m_loadedRecording = ReplayRecording::createForCapture(m_nextRecordingId++);
    changeProxyMode(ReplayProxy::Capturing);

    InspectorInstrumentation::captureStarted(m_page);
    
    // create begin sentinel
    captureEventLoopInput(new BeginSentinel(m_domEventDispatchCount, mark));

    m_cacheController->disableCache();
    captureEventLoopInput(new DisableCache(m_domEventDispatchCount, m_currentMark));
    captureEventLoopInput(new InitializeFocus(m_page, m_domEventDispatchCount, m_currentMark));
    captureEventLoopInput(new InitializeWindow(m_page, m_domEventDispatchCount, m_currentMark));
    // attempt to pull reasonable values here to save in the log, and 
    // also to use for the initial refresh.
    Frame* mainFrame = m_page->mainFrame();
    NavigateToPage* reloadInput = new NavigateToPage(mainFrame->document()->securityOrigin(),
                                                     mainFrame->document()->url().string(),
                                                     mainFrame->loader()->referrer(),
                                                     m_domEventDispatchCount, m_currentMark);
    captureEventLoopInput(reloadInput);

    //The call to scheduleLocationChange should be the same on capture and replay.
    page()->networkProxy()->setExpectsPageLoad(true);
    // TODO: right now, the last two args make this page load count in the BFCache
    // and the history. Is this a bad idea? They are not counted during replays.
    mainFrame->navigationScheduler()->scheduleLocationChange(reloadInput->securityOrigin().get(),
                                                             reloadInput->url(),
                                                             reloadInput->referrer(),
                                                             false, false);
}

bool ReplayController::endCapturing(const PositionMark& mark)
{
    // this protects against receiving stopRecording commands twice before
    // the UI is notified that recording is stopped (which disables that command).
    if (!capturing()) {
        LOG(DeterministicReplay, "%-30sIgnored request to stop recording; not in a valid state to do so.\n", "[ReplayController]");
        return false;
    }

    LOG(DeterministicReplay, "%-30sEnding capture.\n", "[ReplayController]");

    captureEventLoopInput(new EnableCache(m_domEventDispatchCount, mark));
    captureEventLoopInput(new EndSentinel(m_domEventDispatchCount, mark));
    //normally performed by captureEventLoopInput (called on following input), but this is last input.
    finalizePreviousInput(m_domEventDispatchCount);

    m_loadedRecording->inputLog()->endCapturing();
    // TODO: (Issue #236): turn serialization into an API (that doesn't involve ReplayController)
    serialize();

    // hold on to a reference so unloading the recording doesn't deallocate it
    RefPtr<ReplayRecording> recording = m_loadedRecording;

    unloadRecording(true);
    m_cacheController->enableCache();
    changeProxyMode(ReplayProxy::Open);
    
    //now replay is possible, but requires a reset.
    m_status = PlaybackUninitialized;
    InspectorInstrumentation::captureFinished(m_page);
    InspectorInstrumentation::recordingCreated(m_page, recording);
    return true;
}

//-- replay API

void ReplayController::pauseAtNextMark()
{
    ASSERT(replaying());

    if (m_status == ReplayToCompletion)
        m_status = ReplayUpToMarkIndex;

    if (m_status == ReplayUpToMarkIndex) {
        // finish all inputs with the current mark index. This will cause a pause when
        // a dispatchable input with different index comes up.
        m_stopBeforeMarkIndex = m_currentMark.index() + 1;
    }
}

void ReplayController::replayUpToMarkIndex(PositionMarkIndex index, ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(DeterministicReplay, "%-30s About to begin replay to mark %d.\n", "[ReplayController]", index);

    // only undone by recording, or cancelling playback.
    changeProxyMode(ReplayProxy::Replaying);

    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished || index < m_currentMark.index())
        resetPlaybackState();

    m_status = ReplayUpToMarkIndex;
    m_stopBeforeMarkIndex = index;
    m_replayMode = mode;

    InspectorInstrumentation::playbackStarted(m_page);
    maybeDispatchInput();
}

void ReplayController::replayToCompletion(ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(DeterministicReplay, "%-30s About to begin replay to completion.\n", "[ReplayController]");

    // only undone by recording, or cancelling playback.
    changeProxyMode(ReplayProxy::Replaying);

    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished)
        resetPlaybackState();

    m_replayMode = mode;
    m_status = ReplayToCompletion;
    InspectorInstrumentation::playbackStarted(m_page);
    maybeDispatchInput();
}

    
void ReplayController::cancelPlayback()
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
            changeProxyMode(ReplayProxy::Open);
            InspectorInstrumentation::playbackCancelled(m_page);
    }

}
    
//-- external callbacks    

void ReplayController::willDispatchEvent(const Event& event, DOMWindow* window, Node* node, const PositionMark&)
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
            syncDispatchInput();
        } else {
            // This usually indicates nondeterministic APIs, or reordering of dispatchable inputs and DOM events.
            String errorMessage = String::format("more DOM events were dispatched (%d) than expected (%d) before the next input.", m_runningInput->DOMEventQuota(), m_runningInput->DOMEventQuota()-1);
            playbackError(false, errorMessage);
        }
    }
}
    
void ReplayController::didDispatchEvent()
{
    m_domEventDispatchDepth--;

    if (replaying())
        maybeDispatchInput();
}

void ReplayController::frameNavigated(DocumentLoader* loader)
{
    if (!capturing() && !replaying())
        return;
    
    page()->networkProxy()->setExpectsPageLoad(false);
    page()->networkProxy()->setInitiatingPageLoad(false);
    loader->frame()->script()->globalObject(mainThreadNormalWorld())->setReplayInputLog(m_loadedRecording->inputLog());
}

void ReplayController::willFireTimer(int timerId, Document* document)
{
    if (isCapturingDocument(document))
        capturePageInput(new TimerFired(timerId, document)); // send to frontend, too.
}

void ReplayController::willRunPendingScriptsForDocument(Document* document) {
    if (isCapturingDocument(document))
        captureEventLoopInput(new RanPendingScripts(document));
}

//-- accessors
PassRefPtr<CacheController> ReplayController::cacheController() const
{
    return m_cacheController;
}

PassRefPtr<ReplayRecording> ReplayController::loadedRecording() const
{
    return m_loadedRecording;
}

bool ReplayController::isCapturingDocument(Document* document) const
{
    if (!capturing() || !document)
        return false;
    
    JSDOMWindow* window = toJSDOMWindow(document->frame(), mainThreadNormalWorld());
    return window && window->inputLog() && 
           window->inputLog()->isActive() && window->inputLog()->capturing();
}

bool ReplayController::isReplayingDocument(Document* document) const
{
    if (!replaying() || !document)
        return false;
    
    JSDOMWindow* window = toJSDOMWindow(document->frame(), mainThreadNormalWorld());
    return window && window->inputLog() &&
           window->inputLog()->isActive() && window->inputLog()->replaying();
}

void ReplayController::capturePageInput(EventLoopInput* input)
{
    if (!capturing())
        return;

    // flush document event queue, so event dispatch count reflects anything 
    // dispatched or queued before this input was captured.
    m_page->mainFrame()->document()->eventQueue()->flush();
    captureEventLoopInput(input);
    InspectorInstrumentation::capturedPageInput(m_page, input);
}

bool ReplayController::playbackError(bool isFatal, const String& errorMessage)
{
    ASSERT(replaying());

    LOG(DeterministicReplay, "%-30s %sPlayback error: %s", "[ReplayController]",
        isFatal ? "FATAL " : "",
        errorMessage.utf8().data());
    
    if (isFatal) {
        LOG(DeterministicReplay, "%-30s Terminating playback due to fatal error.", "[ReplayController]");
        cancelPlayback();
        InspectorInstrumentation::playbackError(m_page, true, errorMessage);
        return true;
    }
    
    if (m_errorStrategy == ContinueOnError) {
        LOG(DeterministicReplay, "%-30s Continuing past non-fatal error.", "[ReplayController]");
    } else {
        LOG(DeterministicReplay, "%-30s Reporting and pausing because of non-fatal error.", "[ReplayController]");
        pauseReplay(m_currentMark.index());
        InspectorInstrumentation::playbackError(m_page, isFatal, errorMessage);
    }
    
    return m_errorStrategy == PauseOnError;
}

// Private methods

void ReplayController::captureEventLoopInput(EventLoopInput* input)
{
    ASSERT(capturing());
    
    input->setDispatchCount(m_domEventDispatchCount);
    finalizePreviousInput(input->dispatchCount());

    m_currentMark = input->mark();
    m_loadedRecording->inputLog()->append(input);
    m_previousInput = input;
}

void ReplayController::finalizePreviousInput(int currentDispatchCount)
{
    ASSERT(capturing());
    if (m_previousInput) {
        unsigned eventQuota = currentDispatchCount - m_previousInput->dispatchCount();
        m_previousInput->setDOMEventQuota(eventQuota);
        m_previousInput->seal();
    }
}

void ReplayController::didDispatch(EventLoopInput* input)
{
    ASSERT(replaying());
    if (!m_runningInput) {
        LOG(DeterministicReplay, "%-30s Clearing pending didDispatch flag, since it appears replay stopped while processing this event (i.e., inside a debugger's inner event loop, or because of a fatal replay error)\n", "ReplayController");
        return;
    }
    ASSERT(m_dispatching);
    ASSERT(input == m_runningInput);
#ifdef NDEBUG
    UNUSED_PARAM(input);
#endif // !defined(NDEBUG)

    InspectorInstrumentation::playbackHitMark(m_page, m_runningInput->mark().index());
    m_runningInput = 0;
    m_dispatching = false;

    if (m_status == PlaybackPaused)
        return;

    // if the expected input never came, just forget we were expecting it.
    // it may have been consumed by another instrumenting agent.
    maybeDispatchInput();
}

void ReplayController::maybeDispatchInput()
{
    ASSERT(replaying());

    // if something is already in the midst of being replayed, then do nothing.
    if (m_runningInput)
        return;

    // if there was an error between now the previous dispatch, report it now.
    if (m_loadedRecording->inputLog()->hasError()) {
        // TODO: some of these should be recoverable, but for now they are all fatal.
        // we must clear the error
        playbackError(true, m_loadedRecording->inputLog()->errorMessage());
        return;
    }

    // if there is no waiting input, then get one.
    if (!m_waitingInput)
        m_waitingInput = popDispatchInput(m_loadedRecording->inputLog());

    m_currentMark = m_waitingInput->mark();
    
    // if running the waiting input would proceed past the desired mark, pause.
    if ((m_status == ReplayUpToMarkIndex && m_stopBeforeMarkIndex == m_currentMark.index())
        || m_status == ReplayToStart) {
        pauseReplay(m_stopBeforeMarkIndex);
        return;
    }

    if (m_waitingInput->type() == ReplayInputTypes::EndSentinel) {
        finishReplay();
        return;
    }
    
    //if this event is overdue, then the replay has diverged (probably caused by user interaction)
    if (m_waitingInput->dispatchCounted() && m_waitingInput->dispatchCount() < m_domEventDispatchCount) {
        String errorMessage = String::format("Next input should be injected after %d retired DOM events, but %d DOM events have retired.",
                                             m_waitingInput->dispatchCount(), 
                                             m_domEventDispatchCount);

        if (playbackError(false, errorMessage))
            return;
    }
    
    //if this event is next in line or overdue, promote it to "running", then fire immediately.
    if (!m_waitingInput->dispatchCounted() || m_waitingInput->dispatchCount() <= m_domEventDispatchCount) {
        m_runningInput = m_waitingInput;
        m_waitingInput = 0;
        asyncDispatchInput();
    }

    //otherwise, it will be considered for dispatch after every future event.
    else
        LOG(DeterministicReplay, "%-30s Waiting to dispatch next input (current: %d@; target: %d@).\n",
            "[ReplayController]", m_domEventDispatchCount, m_waitingInput->dispatchCount());
}

void ReplayController::timerFired(Timer<ReplayController>*)
{
    syncDispatchInput();
}

void ReplayController::asyncDispatchInput()
{
    ASSERT(m_runningInput);
    ASSERT(replaying());

    if (m_timer.isActive())
        m_timer.stop();

    switch (m_replayMode) {
    case FullSpeed:
        // delay 1ms so will happen after 0ms delay timers fire
        m_timer.startOneShot(1.0 * 0.001);
        break;

    case Realtime: {
        // The goal is to reproduce the delay between dispatched inputs that
        // was observed during the recording. So, we need to compute how much time
        // to wait such that the elapsed time (since previous dispatch) plus the wait
        // time (until next dispatch) will equal the observed delay between the
        // previous and current input.

        // sometimes, the previous mark time isn't set for some reason.
        if (m_previousMarkTime == 0.0)
            m_previousMarkTime = m_runningInput->mark().time();

        double targetInterval = m_runningInput->mark().time() - m_previousMarkTime;
        double elapsed = monotonicallyIncreasingTime() - m_previousDispatchStartTime;
        double waitInterval = targetInterval - elapsed;

        // a negative wait time means that dispatch took longer on replay than on
        // capture. In this case, proceed without waiting at all (subject to
        // the nonzero interval condition as in the FullSpeed replay mode).
        if (waitInterval < 0.0)
            waitInterval = (1.0 * 0.001);

        LOG(DeterministicReplay, "%-30s WAIT: %.3f ms", "[ReplayController]", waitInterval*1000.0);
        
        if (waitInterval > 1000.0) {
            LOG_ERROR("%-30s ERROR: tried to wait for over 1000 seconds; this is probably a bug.",
                      "[ReplayController]");
            waitInterval = 1.0 * 0.001;
        }
        
        m_timer.startOneShot(waitInterval);
        break;
    }
    }
}

void ReplayController::syncDispatchInput()
{
    ASSERT(replaying() && m_runningInput);

    // flush document event queue before dispatching our own events.
    m_page->mainFrame()->document()->eventQueue()->flush();

    if (m_replayMode == Realtime) {
        m_previousDispatchStartTime = monotonicallyIncreasingTime();
        m_previousMarkTime = m_runningInput->mark().time();
    }
    m_domEventRemainingQuota = m_runningInput->DOMEventQuota();
    LOG(DeterministicReplay, "%-30s ----------------------------------------------",
                   "[ReplayController");
    LOG(DeterministicReplay, "%-30s DISPATCH: %s\n", "[ReplayController]",
                   m_runningInput->toString().utf8().data());
    m_dispatching = true;
    m_runningInput->dispatch(this);
}
        

void ReplayController::resetPlaybackState()
{
    LOG(DeterministicReplay, "%-30s Resetting the replay log...\n", "[ReplayController]");

    unplugInputLogFromPage(m_page);

    m_waitingInput = 0;
    m_runningInput = 0;
    m_domEventDispatchCount = 0;
    m_currentMark = 0;
    m_previousMarkTime = 0.0;
    m_previousDispatchStartTime = 0.0;
    if (m_loadedRecording)
        m_loadedRecording->inputLog()->reset();
}

void ReplayController::pauseReplay(PositionMarkIndex index)
{
    if (m_timer.isActive())
        m_timer.stop();
    
    m_status = PlaybackPaused;
    InspectorInstrumentation::playbackPaused(m_page, index);
}

void ReplayController::finishReplay()
{
    m_status = PlaybackFinished;
    
    // unplug the ReplayInputLog from JS global object so we don't accidentally 
    // try to pull events from it. Such attempts will fail, since the log is at the end.
    resetPlaybackState();
    InspectorInstrumentation::playbackFinished(m_page);
}

void ReplayController::serialize()
{
    JSONReplayInputSerializer serializer(m_loadedRecording->inputLog());

    LOG(DeterministicReplay, "%-30sMETRIC: memory overhead: %zu bytes\n", "[ReplayController]", serializer.memorySize());

    FILE* file = 0;
    const char* filename = getenv("TIMELAPSE_SERIALIZED_RECORDING_FILENAME");
    if (filename) {
        file = fopen(filename, "w");
        if (!file)
            fprintf(stderr, "Warning: Could not open log file %s for writing.\n", filename);
    }
    if (file) {
        LOG(DeterministicReplay, "%-30sMETRIC: dumping serialized recording to %s\n", "[ReplayController]", filename);
        serializer.serializeToFile(file);
        fclose(file);
    }
}

bool ReplayController::unloadRecording(bool suppressNotifications)
{
    if (!m_loadedRecording) {
        LOG_ERROR("Tried to unload recording, but none was loaded.");
        return false;
    }
    
    if (m_loadedRecording->capturing() || m_loadedRecording->replaying()) {
        LOG_ERROR("Tried to unload recording that was capturing or replaying.");
        return false;
    }

    LOG(DeterministicReplay, "%-30sUnloading recording: %p.\n", "[ReplayController]", (void*)m_loadedRecording.get());
    
    unplugInputLogFromPage(m_page);
    m_loadedRecording = 0;

    if (!suppressNotifications)
        InspectorInstrumentation::recordingUnloaded(m_page);
    return true;

}

bool ReplayController::loadRecording(PassRefPtr<ReplayRecording> prpRecording, bool suppressNotifications)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    ASSERT(!recording->capturing() && !recording->replaying());

    if (m_loadedRecording && m_loadedRecording != recording) {
        LOG_ERROR("Tried to load recording, but a recording is already loaded.");
        return false;
    }
    
    LOG(DeterministicReplay, "%-30sLoading recording: %p.\n", "[ReplayController]", (void*)recording.get());
    
    resetPlaybackState();

    m_loadedRecording = recording;
    if (!suppressNotifications)
        InspectorInstrumentation::recordingLoaded(m_page, recording);
    return true;
}

void ReplayController::changeProxyMode(ReplayProxy::ProxyMode mode)
{
    m_page->userInputProxy()->setProxyMode(mode);
    m_page->asyncEventProxy()->setProxyMode(mode);
    m_page->networkProxy()->setProxyMode(mode);
}

bool ReplayController::capturing() const
{
    return m_status == CannotReplay &&
           m_loadedRecording &&
           m_loadedRecording->inputLog()->isActive() &&
           m_loadedRecording->capturing();
}

bool ReplayController::replaying() const
{
    return m_status != CannotReplay &&
           m_status != PlaybackUninitialized &&
           m_loadedRecording &&
           m_loadedRecording->inputLog()->isActive() &&
           m_loadedRecording->replaying();
}
        
}; // namespace WebCore

#endif // ENABLE(TIMELAPSE)
