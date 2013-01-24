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

#if ENABLE(TIMELAPSE)

#include "TimelapseAgentStateMachine.h"

#include "Logging.h"
#include <wtf/Assertions.h>

namespace WebCore {

namespace TimelapseAgentStateNames {
static const char* Disabled = "Disabled";
static const char* EnabledCanCapture = "EnabledCanCapture";
static const char* EnabledCanReplayOrCapture =  "EnabledCanReplayOrCapture";
static const char* WaitingForCapture = "WaitingForCapture";
static const char* WaitingForReplay = "WaitingForReplay";
static const char* Capturing = "Capturing";
static const char* Replaying = "Replaying";
static const char* ReplayPaused = "ReplayPaused";
}

const char* TimelapseAgentStateMachine::stateNameFor(TimelapseAgentStateMachine::State state)
{
    switch (state) {
    case TimelapseAgentStateMachine::Disabled:
        return TimelapseAgentStateNames::Disabled;

    case TimelapseAgentStateMachine::EnabledCanCapture:
        return TimelapseAgentStateNames::EnabledCanCapture;

    case TimelapseAgentStateMachine::EnabledCanReplayOrCapture:
        return TimelapseAgentStateNames::EnabledCanReplayOrCapture;

    case TimelapseAgentStateMachine::WaitingForCapture:
        return TimelapseAgentStateNames::WaitingForCapture;

    case TimelapseAgentStateMachine::WaitingForReplay:
        return TimelapseAgentStateNames::WaitingForReplay;

    case TimelapseAgentStateMachine::Capturing:
        return TimelapseAgentStateNames::Capturing;

    case TimelapseAgentStateMachine::Replaying:
        return TimelapseAgentStateNames::Replaying;

    case TimelapseAgentStateMachine::ReplayPaused:
        return TimelapseAgentStateNames::ReplayPaused;
    }
    ASSERT_NOT_REACHED();
    return NULL;
}

TimelapseAgentStateMachine::TimelapseAgentStateMachine() 
    : m_state(Disabled) { }

bool TimelapseAgentStateMachine::disabled() const
{
    return inState(Disabled);
}

bool TimelapseAgentStateMachine::enabled() const
{
    return !inState(Disabled);
}

bool TimelapseAgentStateMachine::canCapture() const
{
    return inState(EnabledCanCapture) || inState(EnabledCanReplayOrCapture);
}

bool TimelapseAgentStateMachine::canReplay() const
{
    return inState(EnabledCanReplayOrCapture);
}

bool TimelapseAgentStateMachine::replayPaused() const
{
    return inState(ReplayPaused);
}

bool TimelapseAgentStateMachine::capturing() const
{
    return inState(Capturing);
}

bool TimelapseAgentStateMachine::replaying() const
{
    return inState(Replaying);
}

void TimelapseAgentStateMachine::advanceTo(State newState)
{
    switch (newState) {
    case Disabled:
        if (inState(EnabledCanCapture) || inState(EnabledCanReplayOrCapture))
            goto commit_transition;

        break;

    case EnabledCanCapture:
        if (inState(Disabled))
            goto commit_transition;

        break;

    case EnabledCanReplayOrCapture:
        if (inState(Capturing) || inState(Replaying) || inState(ReplayPaused) || inState(EnabledCanReplayOrCapture))
            goto commit_transition;

        break;

    case WaitingForCapture:
        if (inState(EnabledCanCapture) || inState(EnabledCanReplayOrCapture))
            goto commit_transition;
        
        break;
    
    case WaitingForReplay:
        if (inState(EnabledCanReplayOrCapture) || inState(ReplayPaused))
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

#endif // ENABLE(TIMELAPSE)
