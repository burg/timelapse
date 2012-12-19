/*
 *  Copyright (C) 2011, 2012 Brian Burg.
 *  Copyright (C) 2011, 2012 University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */

#include "config.h"
#include "RiggedWeakRandom.h"

#include "Logging.h"
#include "SetRandomSeed.h"
#include <wtf/Assertions.h>
#include <wtf/RandomNumber.h>
#include <wtf/timelapse/ReplayableAction.h>

namespace JSC {

static unsigned createSeed()
{
    return static_cast<unsigned>(randomNumber() * (std::numeric_limits<unsigned>::max() + 1.0));
}

RiggedWeakRandom::RiggedWeakRandom()
    : m_determinismLog(0)
    , m_initialized(false)
    , m_low(0)
    , m_high(0) { }
        
void RiggedWeakRandom::setSeed()
{
    ASSERT(!m_initialized);

    unsigned seed;

    // if no determinism, initialize seed normally.
    if (!m_determinismLog || !m_determinismLog->isActive())
        seed = createSeed();
    else if (m_determinismLog->capturing()) {
        //get a seed, record it.
        seed = createSeed();
        m_determinismLog->append(new SetRandomSeed(seed));
    } else {
        ASSERT(m_determinismLog->replaying());

        //recover seed
        SetRandomSeed* action = static_cast<SetRandomSeed*>(m_determinismLog->popExpectedAction(WTF::ScriptMemoizedDataQueue, ReplayableTypes::SetRandomSeed));
        if (!action) // error handling case
            seed = createSeed();
        else
            seed = action->randomSeed();

        LOG(TimelapseJSCActions, "%-30s Initialized random seed from captured value.", "[RiggedWeakRandom]");
    }
    
    //actually set up the instance.
    m_low = seed ^ 0x49616E42;
    m_high = seed;
    m_initialized = true;
}
    
void RiggedWeakRandom::configureDeterminism(PassRefPtr<DeterminismLog> prpDeterminismLog)
{
    m_determinismLog = prpDeterminismLog;
    LOG(TimelapseJSCActions, "%-30s Configured determinism. (DeterminismLog=%p)\n",
        "[RiggedWeakRandom]", (void*)m_determinismLog.get());
}
            
unsigned RiggedWeakRandom::advance()
{
    if (!m_initialized)
        setSeed();
    
    m_high = (m_high << 16) + (m_high >> 16);
    m_high += m_low;
    m_low += m_high;
    return m_high;
}
        
} // namespace JSC

