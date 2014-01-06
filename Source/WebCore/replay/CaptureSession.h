/*
 * Copyright (C) 2013 University of Washington. All rights reserved.
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

#ifndef CaptureSession_h
#define CaptureSession_h

#if ENABLE(WEB_REPLAY)

#include <wtf/Noncopyable.h>
#include <wtf/RefCounted.h>
#include <wtf/Vector.h>

namespace WebCore {

class ReplayRecording;

typedef Vector<RefPtr<ReplayRecording>>::const_iterator RecordingIterator;

class CaptureSession : public RefCounted<CaptureSession> {
    WTF_MAKE_NONCOPYABLE(CaptureSession);
public:
    static RefPtr<CaptureSession> create();
    ~CaptureSession();

    int uid() const { return m_uid; };
    double creationTimestamp() const { return m_timestamp; }

    size_t size() const { return m_recordings.size(); }
    RefPtr<ReplayRecording> at(size_t position) const { return m_recordings.at(position); }

    RecordingIterator begin() const { return m_recordings.begin(); };
    RecordingIterator end() const { return m_recordings.end(); };
    RecordingIterator iteratorAtRecording(RefPtr<ReplayRecording>) const;

    void append(RefPtr<ReplayRecording>);
    void insert(size_t position, RefPtr<ReplayRecording>);
    void remove(size_t position);

private:
    CaptureSession();

    static int s_nextUid;

    Vector<RefPtr<ReplayRecording>> m_recordings;
    int m_uid;
    double m_timestamp;
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // CaptureSession_h
