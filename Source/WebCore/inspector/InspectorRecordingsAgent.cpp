/*
 *  Copyright (C) 2011-2013, Brian Burg.
 *  Copyright (C) 2011-2013, University of Washington. All rights reserved.
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
#include "InspectorRecordingsAgent.h"

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include "InstrumentingAgents.h"
#include "JSONEncoderContext.h"
#include "ReplayRecording.h"

namespace WebCore {

InspectorRecordingsAgent::InspectorRecordingsAgent(InstrumentingAgents* instrumentingAgents)
: InspectorBaseAgent<InspectorRecordingsAgent>("Recordings", instrumentingAgents)
, m_instrumentingAgents(instrumentingAgents)
{
    m_instrumentingAgents->setInspectorRecordingsAgent(this);
}

InspectorRecordingsAgent::~InspectorRecordingsAgent()
{
    m_instrumentingAgents->setInspectorRecordingsAgent(nullptr);
    m_instrumentingAgents = nullptr;
}

void InspectorRecordingsAgent::setFrontend(InspectorFrontend* frontend)
{
    m_frontend = frontend->recordings();
}

void InspectorRecordingsAgent::clearFrontend()
{
    m_frontend = nullptr;
}

PassRefPtr<ReplayRecording> InspectorRecordingsAgent::findRecording(ErrorString* errorString, int uid)
{
    ASSERT(uid >= 0);

    RecordingsMap::iterator it = m_recordingsMap.find(uid);
    if (it == m_recordingsMap.end()) {
        *errorString = "Couldn't find recording with specified uid";
        return 0;
    }

    return it->value;
}

void InspectorRecordingsAgent::recordingLoaded(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    // in case we didn't know about the loaded recording, add here.
    m_recordingsMap.add(recording->uid(), recording);
}

void InspectorRecordingsAgent::recordingCreated(PassRefPtr<ReplayRecording> prpRecording)
{
    RefPtr<ReplayRecording> recording = prpRecording;
    RecordingsMap::AddResult result = m_recordingsMap.add(recording->uid(), recording);
    // can't have two recordings with same uid
    ASSERT_UNUSED(result, result.isNewEntry);

    if (m_frontend)
        m_frontend->recordingAdded(recording->uid());
}

void InspectorRecordingsAgent::getSerializedRecording(ErrorString* errorString, int uid, RefPtr<TypeBuilder::Recordings::ReplayRecording>& serializedObject)
{
    RefPtr<ReplayRecording> recording = findRecording(errorString, uid);
    if (!recording)
        return;

    serializedObject = JSONCoder::serialize(recording);
}

void InspectorRecordingsAgent::getAvailableRecordings(ErrorString*, RefPtr<TypeBuilder::Array<int> >& recordingsList)
{
    recordingsList = TypeBuilder::Array<int>::create();
    for (RecordingsMap::iterator it = m_recordingsMap.begin(); it != m_recordingsMap.end(); ++it) {
        recordingsList->addItem(it->key);
    }
}

}; // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)
