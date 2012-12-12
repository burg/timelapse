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

#ifndef DeterminismLog_h
#define DeterminismLog_h

#include "ReplayableAction.h"
#include <wtf/RefCounted.h>
#include <wtf/Vector.h>

namespace WTF {

#if !LOG_DISABLED
extern WTFLogChannel LogTimelapseCapturing;
#endif // !LOG_DISABLED

//NOTE: this is only really for debugging purposes. When some confidence in the
//data structure is gained, it can be removed.
struct ActionEntry {
    ActionEntry(ReplayableAction* ca, size_t c)
    : action(ca)
    , count(c) {}

    ReplayableAction* action;
    size_t count; //total event ordering
};

typedef enum {
    NoError,
    ErrorExhaustedMemoizedInput,
    ErrorExhaustedDispatchableActions,
    ErrorUnexpectedActionType,
} ReplayErrorType;

class ActionSerializer;
    
class DeterminismLog : public RefCounted<DeterminismLog> {

public:
    WTF_EXPORT_PRIVATE static PassRefPtr<DeterminismLog> createLogForCapture();

    WTF_EXPORT_PRIVATE ~DeterminismLog();

    //action capturing
    WTF_EXPORT_PRIVATE void endCapturing();
    WTF_EXPORT_PRIVATE void append(ReplayableAction*);
    
    //action replaying
    WTF_EXPORT_PRIVATE void reset();
    WTF_EXPORT_PRIVATE ReplayableAction* currentAction(ReplayableAction::ReplayableType);
    WTF_EXPORT_PRIVATE ReplayableAction* currentDispatchableAction();

    //error handling
    bool hasError() const { return m_errorType != NoError; }
    WTF_EXPORT_PRIVATE String errorMessage() const;
    // TODO: if the previous error allocated any POD, must clean up here.
    void clearError() { m_errorType = NoError; }

    // status
    bool capturing() const { return m_isCapturing; }
    bool replaying() const { return m_isReplaying; }
    bool isActive() const { return m_active; }
    
    //used for temporary deactivation; e.g. when injected scripts are evaluated.
    WTF_EXPORT_PRIVATE void setIsActive(bool);
    WTF_EXPORT_PRIVATE size_t memorySize() const;
    WTF_EXPORT_PRIVATE void serialize(ActionSerializer*) const;

private:
    DeterminismLog(bool capturing, bool replaying);

    //These are "pull" actions that feed deterministic data to computation.
    Vector<ActionEntry> m_memoizedActions;
    //These are dispatchable "push" actions that decide what to compute.
    Vector<ActionEntry> m_dispatchActions;
    bool m_isCapturing;
    bool m_isReplaying;
    bool m_active;
    ReplayErrorType m_errorType;
    union {
        ReplayableAction::ReplayableType expectedActionType;
    } m_errorData;
    
    size_t m_memoizedReplayPosition;
    size_t m_dispatchReplayPosition;
    size_t m_captureCount;
};

} // namespace WTF

using WTF::DeterminismLog;

#endif // DeterminismLog_h
