/*
 *  Copyright (C) 2011-2013 Brian Burg.
 *  Copyright (C) 2011-2013 University of Washington. All rights reserved.
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

#if ENABLE(WEB_REPLAY)

#include "ReplayController.h"

#include "CacheController.h"
#include "CaptureInputIterator.h"
#include "DisableCache.h"
#include "DocumentLoader.h"
#include "DOMWindow.h"
#include "EnableCache.h"
#include "Event.h"
#include "FrameTree.h"
#include "InitializeFocus.h"
#include "InitializeWindow.h"
#include "InspectorInstrumentation.h"
#include "Location.h"
#include "Logging.h"
#include "MainFrame.h"
#include "NavigateToPage.h"
#include "Node.h"
#include "Page.h"
#include "ReplayInputIterator.h"
#include "ReplayRecording.h"
#include "ScriptController.h"
#include "ScrollingCoordinator.h"
#include "SecurityOrigin.h"
#include "SentinelActions.h"
#include "URL.h"
#include <stdarg.h>
#include <wtf/text/CString.h>

namespace WebCore {

#if !LOG_DISABLED
static void dumpEventDispatchInfo(const Event& event, Frame*, bool wasIgnored)
{
    EventTarget* target = event.target();
    if (!target)
        return;

    if (Node* node = target->toNode())
        LOG(DeterministicReplay, "%-20s --->%s DOM event: type=%s, target=%d/node[%p] %s\n", "ReplayEvents",
            (wasIgnored) ? "Unrelated" : "Dispatching",
            event.type().string().utf8().data(),
            frameIndexFromDocument((node->inDocument()) ? &node->document() : node->ownerDocument()),
            (void*)node,
            node->nodeName().utf8().data());

    else if (DOMWindow* window = target->toDOMWindow())
        LOG(DeterministicReplay, "%-20s --->%s DOM event: type=%s, target=%d/window[%p] %s\n", "ReplayEvents",
            (wasIgnored) ? "Unrelated" : "Dispatching",
            event.type().string().utf8().data(),
            frameIndexFromDocument(window->document()),
            (void*)window,
            window->location()->href().utf8().data());
}
#endif // !LOG_DISABLED

ReplayController::ReplayController(Page& page)
    : m_page(page)
    , m_nextRecordingId(1)
    , m_loadedRecording(nullptr)
    , m_cacheController(std::make_unique<CacheController>())
    , m_stopBeforeMarkIndex(0)
    , m_status(CannotReplay)
    , m_errorStrategy(PauseOnError) { }

ReplayController::~ReplayController()
{
}

void ReplayController::beginCapturing()
{
    if (m_loadedRecording) {
        LOG_ERROR("Tried to begin capturing a replay recording, but another recording is still loaded.");
        cancelPlayback();
        return;
    }

    m_status = CannotReplay;
    m_loadedRecording = ReplayRecording::create(m_nextRecordingId++);
    m_activeIterator = m_loadedRecording->createCaptureIterator(m_page);
    changeProxyMode(ReplayProxy::Capturing);

#if ENABLE(THREADED_SCROLLING)
    if (ScrollingCoordinator* scrollingCoordinator = m_page.scrollingCoordinator())
        scrollingCoordinator->setForceDeterministicScrolling(true);
#endif

    InspectorInstrumentation::captureStarted(&m_page);
    // Combine the following inputs into a single extent, since they are synchronous.
    EventLoopInputExtent extent(m_activeIterator.get());

    // create begin sentinel
    m_activeIterator->storeInput(std::make_unique<BeginSentinel>());

    m_cacheController->disableCache();
    m_activeIterator->storeInput(std::make_unique<DisableCache>());
    m_activeIterator->storeInput(InitializeFocus::createFromPage(m_page));
    m_activeIterator->storeInput(InitializeWindow::createFromPage(m_page));
    // attempt to pull reasonable values here to save in the log, and
    // also to use for the initial refresh.
    MainFrame& mainFrame = m_page.mainFrame();
    m_activeIterator->storeInput(std::make_unique<NavigateToPage>(mainFrame.document()->securityOrigin(),
                                                                  mainFrame.document()->url().string(),
                                                                  mainFrame.loader().referrer()));

    // TODO: right now, the last two args make this page load count in the BFCache
    // and the history. Is this a bad idea? They are not counted during replays.
    mainFrame.navigationScheduler().scheduleLocationChange(mainFrame.document()->securityOrigin(),
                                                           mainFrame.document()->url(),
                                                           mainFrame.loader().referrer(),
                                                           false, false);
}

bool ReplayController::endCapturing()
{
    // This guard protects against receiving stopRecording commands twice before
    // the UI is notified that recording is stopped (which disables that command).
    if (!capturing()) {
        LOG(DeterministicReplay, "%-20sIgnored request to stop capturing; not in a valid state to do so.\n", "ReplayController::endCapturing");
        return false;
    }

    // An event loop input extent is not needed here, as these inputs do not trigger events.
    m_activeIterator->storeInput(std::make_unique<EnableCache>());
    m_activeIterator->storeInput(std::make_unique<EndSentinel>());
    m_activeIterator = nullptr;

#if ENABLE(THREADED_SCROLLING)
    if (ScrollingCoordinator* scrollingCoordinator = m_page.scrollingCoordinator())
        scrollingCoordinator->setForceDeterministicScrolling(false);
#endif

    // Hold on to a reference so unloading the recording doesn't deallocate it.
    RefPtr<ReplayRecording> recording = m_loadedRecording;
    unloadRecording(true);
    m_cacheController->enableCache();

    // Now replay is possible, but requires a reset.
    m_status = PlaybackUninitialized;
    InspectorInstrumentation::captureFinished(&m_page);
    InspectorInstrumentation::recordingCreated(&m_page, recording);

    // Permanently "suspend" active objects, such as timers, marquees, loaders, etc.
    for (Frame* frame = &m_page.mainFrame(); frame; frame = frame->tree().traverseNext())
        frame->document()->suspendActiveDOMObjects(ActiveDOMObject::DocumentWillBecomeInactive);

    return true;
}

void ReplayController::pauseAtNextMark()
{
    ASSERT(replaying());
    // Finish all inputs with the current mark index. If the dispatcher starts to
    // dispatch an input with a different index, we will pause it first.
    m_status = ReplayUpToMarkIndex;
    m_stopBeforeMarkIndex = dispatcher().currentMark().index() + 1;
}

void ReplayController::replayUpToMarkIndex(PositionMarkIndex index, ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(DeterministicReplay, "%-20s About to begin replay to mark %d.\n", "ReplayController", index);

    bool isBackwardsMovement = replaying() && dispatcher().currentMark().index() > index;
    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished || isBackwardsMovement) {
        cancelPlayback();
        changeProxyMode(ReplayProxy::Replaying);
        m_activeIterator = m_loadedRecording->createReplayIterator(m_page, this);
    }

    m_status = ReplayUpToMarkIndex;
    m_stopBeforeMarkIndex = index;

    InspectorInstrumentation::playbackStarted(&m_page);
    dispatcher().setMode(mode);
    dispatcher().run();
}

void ReplayController::replayToCompletion(ReplayMode mode)
{
    ASSERT(m_status != CannotReplay);

    LOG(DeterministicReplay, "%-20s About to begin replay to completion.\n", "ReplayController");

    if (m_status == PlaybackUninitialized || m_status == PlaybackFinished) {
        cancelPlayback();
        changeProxyMode(ReplayProxy::Replaying);
        m_activeIterator = m_loadedRecording->createReplayIterator(m_page, this);
    }

    m_status = ReplayToCompletion;
    InspectorInstrumentation::playbackStarted(&m_page);
    dispatcher().setMode(mode);
    dispatcher().run();
}


void ReplayController::cancelPlayback()
{
    switch (m_status) {
        case CannotReplay:
            ASSERT_NOT_REACHED();
        case PlaybackUninitialized:
            break; // There's nothing to cancel.

        // From here, we intentionally fall through the cases. Depending on the current state, we
        // need to perform some or all of the following transitions to cancel gracefully:
        //
        //    running --> paused --> finished --> cancelled
        case ReplayToStart:
        case ReplayUpToMarkIndex:
        case ReplayToCompletion:
        case PlaybackResetting:
            // This cancels any pending timers, and fires instrumentation.
            pauseReplay();

        case PlaybackPaused:
            // This disconnects the determinism log from global object, and fires instrumentation.
            finishReplay();

        case PlaybackFinished:
            changeProxyMode(ReplayProxy::Open);
            InspectorInstrumentation::playbackCancelled(&m_page);
    }
}

void ReplayController::willDispatchEvent(const Event& event, Frame* frame, const PositionMark&)
{
    if (!frame)
        return;

    InputIterator* it = frame->document() ? frame->document()->inputIterator() : 0;
    bool shouldIgnore =  !it || (!it->isCapturing() && !it->isReplaying());

#if !LOG_DISABLED
    dumpEventDispatchInfo(event, frame, shouldIgnore);
#else
    UNUSED_PARAM(event);
#endif // !LOG_DISABLED

    if (shouldIgnore)
        return;

    // Finally, increment the execution tick before the actual dispatch occurs.
    it->incrementExecutionTicks();
}

void ReplayController::frameNavigated(DocumentLoader* loader)
{
    if (!capturing() && !replaying())
        return;

    // We store the input iterator in both Document and JSDOMWindow, so that
    // replay state is accessible from script and layout without layering violations.
    loader->frame()->document()->setInputIterator(m_activeIterator.get());
    loader->frame()->script().globalObject(mainThreadNormalWorld())->setInputIterator(m_activeIterator.get());
}

CacheController& ReplayController::cacheController() const
{
    return *m_cacheController;
}

PassRefPtr<ReplayRecording> ReplayController::loadedRecording() const
{
    return m_loadedRecording;
}

void ReplayController::playbackError(bool isFatal, const String& errorMessage)
{
    ASSERT(replaying());

    LOG(DeterministicReplay, "%-20s %sPlayback error: %s", "ReplayController",
        isFatal ? "FATAL " : "",
        errorMessage.utf8().data());

    if (isFatal) {
        LOG(DeterministicReplay, "%-20s Terminating playback due to fatal error.", "ReplayController");
        cancelPlayback();
        InspectorInstrumentation::playbackError(&m_page, true, errorMessage);
        return;
    }

    if (m_errorStrategy == ContinueOnError) {
        LOG(DeterministicReplay, "%-20s Continuing past non-fatal error.", "ReplayController");
    } else {
        LOG(DeterministicReplay, "%-20s Reporting and pausing because of non-fatal error.", "ReplayController");
        pauseReplay();
        InspectorInstrumentation::playbackError(&m_page, isFatal, errorMessage);
    }
}

void ReplayController::willDispatchInput(const EventLoopInput& input)
{
    bool pauseAtSpecificMark = (m_status == ReplayUpToMarkIndex && m_stopBeforeMarkIndex == input.mark().index());
    if (m_status == ReplayToStart || pauseAtSpecificMark) {
        pauseReplay();
    }
}

void ReplayController::didDispatchInput(const EventLoopInput& input)
{
    InspectorInstrumentation::playbackHitMark(&m_page, input.mark().index());
}

void ReplayController::didDispatchFinalInput()
{
    finishReplay();
}

void ReplayController::imageCaptured(const String& imageDataUri)
{
    InspectorInstrumentation::imageCaptured(&m_page, imageDataUri);
}

void ReplayController::resetReplayState()
{
    LOG(DeterministicReplay, "%-20s Clearing input iterator for page: %p\n", "ReplayController", (void*)(&m_page));

    m_activeIterator = nullptr;
    for (Frame* frame = &m_page.mainFrame(); frame; frame = frame->tree().traverseNext()) {
        frame->script().globalObject(mainThreadNormalWorld())->setInputIterator(nullptr);
        frame->document()->setInputIterator(nullptr);
    }
}

void ReplayController::pauseReplay()
{
    dispatcher().pause();

    m_status = PlaybackPaused;
    InspectorInstrumentation::playbackPaused(&m_page, dispatcher().currentMark().index());
}

void ReplayController::finishReplay()
{
    m_status = PlaybackFinished;
    resetReplayState();
    InspectorInstrumentation::playbackFinished(&m_page);
}

bool ReplayController::unloadRecording(bool suppressNotifications)
{
    ASSERT(!capturing());

    if (!m_loadedRecording) {
        LOG_ERROR("Tried to unload recording, but none was loaded.");
        return false;
    }

    if (!(m_status == PlaybackFinished || m_status == PlaybackUninitialized || m_status == CannotReplay)) {
        LOG_ERROR("Tried to unload recording that was capturing or replaying.");
        return false;
    }

    LOG(DeterministicReplay, "%-20sUnloading recording: %p.\n", "ReplayController", (void*)m_loadedRecording.get());

    resetReplayState();
    m_loadedRecording = nullptr;
    changeProxyMode(ReplayProxy::Open);

    if (!suppressNotifications)
        InspectorInstrumentation::recordingUnloaded(&m_page);
    return true;

}

bool ReplayController::loadRecording(PassRefPtr<ReplayRecording> prpRecording, bool suppressNotifications)
{
    ASSERT(!capturing());

    RefPtr<ReplayRecording> recording = prpRecording;
    ASSERT(m_status == PlaybackFinished || m_status == PlaybackUninitialized || m_status == CannotReplay);

    if (m_loadedRecording && m_loadedRecording != recording) {
        LOG_ERROR("Tried to load recording, but a recording is already loaded.");
        return false;
    }

    LOG(DeterministicReplay, "%-20sLoading recording: %p.\n", "ReplayController", (void*)recording.get());

    m_loadedRecording = recording;
    if (!suppressNotifications)
        InspectorInstrumentation::recordingLoaded(&m_page, recording);
    return true;
}

void ReplayController::changeProxyMode(ReplayProxy::ProxyMode mode)
{
    if (m_page.replayProxy().mode() != mode)
        m_page.replayProxy().setMode(mode);
}

bool ReplayController::capturing() const
{
    return m_status == CannotReplay &&
           m_activeIterator && m_activeIterator->isCapturing();
}

bool ReplayController::replaying() const
{
    return m_status != CannotReplay &&
           m_status != PlaybackUninitialized &&
           m_activeIterator && m_activeIterator->isReplaying();
}

EventLoopInputDispatcher& ReplayController::dispatcher() const
{
    ASSERT(m_activeIterator);
    ASSERT(m_activeIterator->isReplaying());

    return static_cast<ReplayInputIterator*>(m_activeIterator.get())->dispatcher();
}

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
