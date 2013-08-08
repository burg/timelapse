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

#ifndef ScriptProbeServer_h
#define ScriptProbeServer_h

#if ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)

#include "ScriptValue.h"
#include <wtf/HashMap.h>
#include <wtf/HashSet.h>
#include <wtf/PassOwnPtr.h>
#include <wtf/Vector.h>
#include <wtf/text/TextPosition.h>
#include <wtf/text/WTFString.h>

namespace JSC {
class DebuggerCallFrame;
}

namespace WebCore {
class ScriptObject;
class ScriptProbe;
class ScriptValue;

class ScriptProbeServer {
    WTF_MAKE_NONCOPYABLE(ScriptProbeServer); WTF_MAKE_FAST_ALLOCATED;
public:
    typedef intptr_t ScriptId;

    static PassOwnPtr<ScriptProbeServer> create();
    virtual ~ScriptProbeServer();

    void addProbeForScriptId(ScriptId, PassRefPtr<ScriptProbe>);
    void removeProbeForScriptId(ScriptId, PassRefPtr<ScriptProbe>);
    void clearProbesForScriptId(ScriptId);
    void setIsActive(bool active) { m_isActive = active; }
    bool isActive() const { return m_isActive; }
    void setPauseTrigger(uint probeId, uint counter)
    {
        m_triggerPauseData.probeId = probeId;
        m_triggerPauseData.counter = counter;
    }
    void addSampleFromConsole(int probeId, ScriptState*);

    // Callback from ScriptDebugServer.
    void atStatement(const JSC::DebuggerCallFrame&, intptr_t scriptId, int lineNumber, int columnNumber);
private:
    typedef HashSet<RefPtr<ScriptProbe> > ProbeSet;
    typedef HashMap<int, RefPtr<ScriptProbe> > ProbeMap;
    typedef HashMap<TextPosition, ProbeSet> PositionToScriptProbeMap;
    typedef HashMap<ScriptId, PositionToScriptProbeMap> ScriptIdToPositionsMap;

    ScriptProbeServer();

    void captureSamplesIfNeeded(const JSC::DebuggerCallFrame&, const ProbeSet&);
    void pauseIfNeeded(const JSC::DebuggerCallFrame&, const ProbeSet&);
    bool findProbesForPosition(ScriptId scriptId, const TextPosition&, ProbeSet& result);

    void clearPauseTrigger()
    {
        m_triggerPauseData.probeId = 0;
        m_triggerPauseData.counter = 0;
    }

    bool m_isActive;
    ScriptIdToPositionsMap m_probeRegistry;
    ProbeMap m_probesById;
    int m_nextBatchId;
    struct {
        unsigned probeId;
        unsigned counter;
    } m_triggerPauseData;
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY) && ENABLE(JAVASCRIPT_DEBUGGER)

#endif // ScriptProbeServer_h
