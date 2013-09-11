/*
 *  Copyright (C) 2013, Brian Burg.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#ifndef ReplayInputIterator_h
#define ReplayInputIterator_h

#if ENABLE(WEB_REPLAY)

#include <wtf/Noncopyable.h>
#include <wtf/OwnPtr.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/replay/InputIterator.h>
#include <wtf/replay/NondeterministicInput.h>
#include <wtf/text/AtomicString.h>
#include <wtf/Vector.h>

namespace WebCore {

class EventLoopInputDispatcher;
class EventLoopInputDispatcherClient;
class InputStorage;
class Page;

typedef enum {
    NoReplayError,
    ErrorExhaustedQueue,
    ErrorUnexpectedInputType,
} ReplayErrorType;

struct ReplayErrorData {
    ReplayErrorType error;
    AtomicString expectedInput;
    NondeterministicInput::QueueType queue;
};

class ReplayInputIterator : public WTF::InputIterator {
    WTF_MAKE_NONCOPYABLE(ReplayInputIterator);
public:
    static PassOwnPtr<ReplayInputIterator> create(InputStorage*, Page*, EventLoopInputDispatcherClient*);
    virtual ~ReplayInputIterator();

    // InputIterator API
    virtual bool isCapturing() const { return false; }
    virtual bool isReplaying() const { return m_isActive; }

    virtual void storeInput(PassOwnPtr<NondeterministicInput>);
    virtual NondeterministicInput* loadInput(NondeterministicInput::QueueType, const AtomicString&);
    virtual NondeterministicInput* uncheckedLoadInput(NondeterministicInput::QueueType);

    //used for temporary deactivation; e.g. when injected scripts are evaluated.
    void setIsActive(bool);
    EventLoopInputDispatcher& dispatcher() const { return *m_dispatcher; }

    //error handling
    bool hasError() const { return m_errorData.error != NoReplayError; }
    WTF_EXPORT_PRIVATE String errorMessage() const;
    // TODO: if the previous error allocated any POD, must clean up here.
    void clearError() { m_errorData.error = NoReplayError; }

private:
    ReplayInputIterator(InputStorage*, Page*, EventLoopInputDispatcherClient*);

    InputStorage* m_storage;

    bool m_isActive;
    const OwnPtr<EventLoopInputDispatcher> m_dispatcher;
    ReplayErrorData m_errorData;
    Vector<size_t> m_positions;
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // ReplayInputIterator_h
