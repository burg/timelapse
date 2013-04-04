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


#ifndef ReplayRecording_h
#define ReplayRecording_h

#if ENABLE(TIMELAPSE)

#include <wtf/Vector.h>
#include <wtf/RefCounted.h>
#include <wtf/replay/ReplayInputLog.h>

namespace WTF {
    class ReplayInputLog;
}

namespace WebCore {

class ReplayRecording : public RefCounted<ReplayRecording> {
    friend class ReplayController; // for capturing() / replaying()
public:
    static PassRefPtr<ReplayRecording> createForCapture(int);
    ~ReplayRecording() {}

    int uid() const { return m_uid; }
    double creationTimestamp() const { return m_timestamp; }
    ReplayInputLog* inputLog() const { return m_inputLog.get(); }

protected:
    bool capturing() const { return m_inputLog->capturing(); }
    bool replaying() const { return m_inputLog->replaying(); }
    
private:
    ReplayRecording(int);
    OwnPtr<ReplayInputLog> m_inputLog;
    int m_uid;
    double m_timestamp;
};

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // ReplayRecording_h
