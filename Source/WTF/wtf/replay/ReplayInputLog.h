/*
 *  Copyright (C) 2011, 2012, Brian Burg.
 *  Copyright (C) 2011, 2012, University of Washington. All rights reserved.
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

#ifndef ReplayInputLog_h
#define ReplayInputLog_h

#include "NondeterministicInput.h"
#include <wtf/Noncopyable.h>
#include <wtf/OwnPtr.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/Vector.h>

namespace WTF {

#if !LOG_DISABLED
extern WTFLogChannel LogTimelapseCapturing;
#endif // !LOG_DISABLED

//NOTE: this is only really for debugging purposes. When some confidence in the
//data structure is gained, it can be removed.
struct InputEntry {
    InputEntry(NondeterministicInput* ca, size_t c)
    : input(ca)
    , count(c) {}

    NondeterministicInput* input;
    size_t count; //total event ordering
};

typedef enum {
    NoError,
    ErrorExhaustedQueue,
    ErrorUnexpectedInputType,
} ReplayErrorType;

struct ReplayErrorData {
    ReplayErrorType error;
    NondeterministicInput::ReplayInputType expectedInput;
    ReplayInputQueueType queue;
};

class ReplayInputLog {
    // TODO: (Issue #234): write a clone() method to duplicate recordings
    WTF_MAKE_NONCOPYABLE(ReplayInputLog);
public:
    WTF_EXPORT_PRIVATE static PassOwnPtr<ReplayInputLog> createForCapture();

    WTF_EXPORT_PRIVATE ~ReplayInputLog();

    //input capturing
    WTF_EXPORT_PRIVATE void endCapturing();
    WTF_EXPORT_PRIVATE void append(NondeterministicInput*);
    
    //input replaying
    WTF_EXPORT_PRIVATE void reset();
    WTF_EXPORT_PRIVATE NondeterministicInput* popExpectedInput(ReplayInputQueueType, NondeterministicInput::ReplayInputType);
    WTF_EXPORT_PRIVATE NondeterministicInput* popInput(ReplayInputQueueType);

    //error handling
    bool hasError() const { return m_errorData.error != NoError; }
    WTF_EXPORT_PRIVATE String errorMessage() const;
    // TODO: if the previous error allocated any POD, must clean up here.
    void clearError() { m_errorData.error = NoError; }

    // status
    bool capturing() const { return m_isCapturing; }
    bool replaying() const { return m_isReplaying; }
    bool isActive() const { return m_active; }
    
    //used for temporary deactivation; e.g. when injected scripts are evaluated.
    WTF_EXPORT_PRIVATE void setIsActive(bool);

    template<typename Functor> WTF_EXPORT_PRIVATE typename Functor::ReturnType forEachInputInQueue(ReplayInputQueueType, Functor&);

private:
    typedef Vector<InputEntry> DeterminismQueue;

    ReplayInputLog(bool capturing, bool replaying);

    bool m_isCapturing;
    bool m_isReplaying;
    bool m_active;
    ReplayErrorData m_errorData;
    
    Vector<DeterminismQueue> m_queues;
    Vector<size_t> m_positions;
    size_t m_captureCount;
};


template<typename Functor> inline typename Functor::ReturnType ReplayInputLog::forEachInputInQueue(ReplayInputQueueType queue, Functor& functor)
{
    ASSERT(queue < ReplayInputQueueTypeLength);
    
    for (size_t i = 0; i < m_queues[queue].size(); i++) {
        functor(i, m_queues[queue].at(i).input);
    }
    
    return functor.returnValue();
}

} // namespace WTF

using WTF::ReplayInputLog;

#endif // ReplayInputLog_h
