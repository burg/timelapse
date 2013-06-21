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

#ifndef InspectorRecordingsAgent_h
#define InspectorRecordingsAgent_h

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "EventLoopInput.h"
#include "InspectorBaseAgent.h"
#include "InspectorFrontend.h"

#include <wtf/HashMap.h>
#include <wtf/Noncopyable.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/PassRefPtr.h>
#include <wtf/RefPtr.h>

namespace WebCore {

class InspectorObject;
class InspectorController;
class InspectorFrontend;
class InspectorCompositeState;
class ReplayRecording;

typedef String ErrorString;

 class InspectorRecordingsAgent
    : public InspectorBaseAgent<InspectorRecordingsAgent>
    , public InspectorBackendDispatcher::RecordingsCommandHandler {
    WTF_MAKE_NONCOPYABLE(InspectorRecordingsAgent);
public:
    static PassOwnPtr<InspectorRecordingsAgent> create(InstrumentingAgents* instrumentingAgents, InspectorCompositeState* state)
    {
        return adoptPtr(new InspectorRecordingsAgent(instrumentingAgents, state));
    }

    ~InspectorRecordingsAgent();

    // helper method that's also shared with InspectorReplayAgent
    PassRefPtr<ReplayRecording> findRecording(ErrorString*, int uid);

    void setFrontend(InspectorFrontend*);
    void clearFrontend();

    // Calls from WebKit (InspectorInstrumentation/InstrumentingAgents)
    void recordingLoaded(PassRefPtr<ReplayRecording>);
    void recordingCreated(PassRefPtr<ReplayRecording>);

    // Calls from the frontend
    virtual void getRecording(ErrorString*, int, RefPtr<TypeBuilder::Recordings::ReplayRecording>&) OVERRIDE;
    virtual void getSerializedRecording(ErrorString*, int, RefPtr<TypeBuilder::Recordings::ReplayRecordingNew>&) OVERRIDE;
    virtual void getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int> >&) OVERRIDE;

    // TODO(Issue #271): remove backend-side interpretation of inputs
    static PassRefPtr<TypeBuilder::Recordings::ReplayAction> createInspectorObjectForAction(const EventLoopInput&);

private:
    InspectorRecordingsAgent(InstrumentingAgents*, InspectorCompositeState*);

    InstrumentingAgents *m_instrumentingAgents;
    InspectorFrontend::Recordings* m_frontend;
    typedef HashMap<int, RefPtr<ReplayRecording>, WTF::IntHash<int>, WTF::UnsignedWithZeroKeyHashTraits<int> > RecordingsMap;
    RecordingsMap m_recordingsMap;
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
#endif // InspectorRecordingsAgent_h
