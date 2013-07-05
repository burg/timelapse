/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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

#include "ReplayAgentStateMachine.h"

#include "Logging.h"
#include <wtf/Assertions.h>

namespace WebCore {

namespace ReplayAgentStateNames {
static const char* Disabled = "Disabled";
static const char* RecordingUnloaded = "RecordingUnloaded";
static const char* RecordingLoaded =  "RecordingLoaded";
static const char* WaitingForCapture = "WaitingForCapture";
static const char* Capturing = "Capturing";
static const char* WaitingForReplay = "WaitingForReplay";
static const char* Replaying = "Replaying";
static const char* ReplayPaused = "ReplayPaused";
}

const char* ReplayAgentStateMachine::stateNameFor(ReplayAgentStateMachine::State state)
{
    switch (state) {
    case ReplayAgentStateMachine::Disabled:
        return ReplayAgentStateNames::Disabled;

    case ReplayAgentStateMachine::RecordingUnloaded:
        return ReplayAgentStateNames::RecordingUnloaded;

    case ReplayAgentStateMachine::RecordingLoaded:
        return ReplayAgentStateNames::RecordingLoaded;

    case ReplayAgentStateMachine::WaitingForCapture:
        return ReplayAgentStateNames::WaitingForCapture;

    case ReplayAgentStateMachine::WaitingForReplay:
        return ReplayAgentStateNames::WaitingForReplay;

    case ReplayAgentStateMachine::Capturing:
        return ReplayAgentStateNames::Capturing;

    case ReplayAgentStateMachine::Replaying:
        return ReplayAgentStateNames::Replaying;

    case ReplayAgentStateMachine::ReplayPaused:
        return ReplayAgentStateNames::ReplayPaused;
    }
    ASSERT_NOT_REACHED();
    return NULL;
}

ReplayAgentStateMachine::ReplayAgentStateMachine()
    : m_state(Disabled) { }

bool ReplayAgentStateMachine::disabled() const
{
    return inState(Disabled);
}

bool ReplayAgentStateMachine::enabled() const
{
    return !inState(Disabled);
}

bool ReplayAgentStateMachine::canCapture() const
{
    return inState(RecordingUnloaded);
}

bool ReplayAgentStateMachine::canReplay() const
{
    return inState(RecordingLoaded);
}

bool ReplayAgentStateMachine::replayPaused() const
{
    return inState(ReplayPaused);
}

bool ReplayAgentStateMachine::capturing() const
{
    return inState(Capturing);
}

bool ReplayAgentStateMachine::replaying() const
{
    return inState(Replaying);
}

void ReplayAgentStateMachine::advanceTo(State newState)
{
    switch (newState) {
    case Disabled:
        if (inState(RecordingLoaded) || inState(RecordingUnloaded))
            goto commit_transition;

        break;

    case RecordingUnloaded: // can always get to this state; not idempotent
        if (!inState(RecordingUnloaded))
            goto commit_transition;

        break;

    case RecordingLoaded:
        if (inState(Replaying) || inState(ReplayPaused) || inState(RecordingUnloaded))
            goto commit_transition;

        break;

    case WaitingForCapture:
        if (inState(RecordingUnloaded))
            goto commit_transition;

        break;

    case WaitingForReplay:
        if (inState(RecordingLoaded) || inState(ReplayPaused))
            goto commit_transition;

        break;

    case Capturing:
        if (inState(WaitingForCapture))
            goto commit_transition;

        break;

    case Replaying:
        if (inState(WaitingForReplay))
            goto commit_transition;

    case ReplayPaused:
        if (inState(Replaying))
            goto commit_transition;
    }

    LOG_ERROR("Illegal state transition: %s -> %s\n",
              stateNameFor(m_state), stateNameFor(newState));

commit_transition:
    m_state = newState;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
