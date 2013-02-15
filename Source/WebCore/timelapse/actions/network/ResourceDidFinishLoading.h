/*
 *  Copyright (C) 2012, Brian Burg.
 *  Copyright (C) 2012, University of Washington. All rights reserved.
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

#ifndef ResourceDidFinishLoading_h
#define ResourceDidFinishLoading_h

#if ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include <wtf/timelapse/ActionSerializer.h>

namespace WebCore {
    
    namespace ReplayableTypes {
        extern const char *ResourceDidFinishLoading;
    }
    
    class DeterminismController;
    
    class ResourceDidFinishLoading : public DispatchableAction {
    public:
        ResourceDidFinishLoading(int id, double finishTime);

        int id() const { return m_id; }
        double finishTime() const { return m_finishTime; }

        // DispatchableAction API
        virtual void dispatch(DeterminismController*) OVERRIDE;
        
        // ReplayableAction API
        virtual String toString() const OVERRIDE;
        virtual size_t memorySize() const OVERRIDE;
        virtual void serialize(ActionSerializer*) const OVERRIDE;
        
    private:
        int m_id;
        double m_finishTime;
    };
    
} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // ResourceDidFinishLoading_h

