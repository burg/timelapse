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

#include "config.h"
#include "CaptureSession.h"

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputStorage.h"
#include "InspectorInstrumentation.h"
#include "Logging.h"
#include "Page.h"
#include <wtf/Vector.h>
#include <wtf/replay/NondeterministicInput.h>

namespace WebCore {

RefPtr<CaptureSession> CaptureSession::create()
{
    return adoptRef(new CaptureSession());
}

CaptureSession::CaptureSession()
    : m_recordings(Vector<RefPtr<ReplayRecording>>())
    , m_uid(s_nextUid++)
    , m_timestamp(WTF::currentTimeMS())
{
}

CaptureSession::~CaptureSession()
{
}

RecordingIterator CaptureSession::iteratorAtRecording(RefPtr<ReplayRecording> recording) const
{
    size_t idx = m_recordings.find(recording);
    ASSERT(idx != notFound);
    return begin() + idx;
}

void CaptureSession::append(RefPtr<ReplayRecording> recording)
{
    // For now, only support one recording.
    ASSERT(!m_recordings.size());

    // Since replay locations are specified with recording IDs, we can only
    // have one instance of a recording in the session.
    size_t idx = m_recordings.find(recording);
    ASSERT_UNUSED(idx, idx == notFound);

    m_recordings.append(recording);
}

void CaptureSession::insert(size_t position, RefPtr<ReplayRecording> recording)
{
    m_recordings.insert(position, recording);
}

void CaptureSession::remove(size_t position)
{
    m_recordings.remove(position);
}

int CaptureSession::s_nextUid = 1;

}; // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
