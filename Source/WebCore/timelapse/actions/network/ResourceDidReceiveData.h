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

#ifndef ResourceDidReceiveData_h
#define ResourceDidReceiveData_h

#if ENABLE(TIMELAPSE)

#include "DispatchableAction.h"
#include <wtf/timelapse/ActionSerializer.h>
#include <wtf/Vector.h>

namespace WebCore {
    
    namespace ReplayableTypes {
        extern const char *ResourceDidReceiveData;
    }
    
    class DeterminismController;
    
    class ResourceDidReceiveData : public DispatchableAction {
    public:
        ResourceDidReceiveData(int, const char* data, int length, int encodedLength);
        virtual ~ResourceDidReceiveData();
        
        int id() const { return m_id; }
        const char* data() const { return m_buffer.data(); }
        int length() const { return m_buffer.size(); }
        int encodedLength() const { return m_encodedLength; }

        // DispatchableAction API
        virtual void dispatch(DeterminismController*) OVERRIDE;
        
        // ReplayableAction API
        virtual String toString() const OVERRIDE;
        virtual size_t memorySize() const OVERRIDE;
        virtual void serialize(ActionSerializer*) const OVERRIDE;
        
    private:
        int m_id;
        Vector<char, 0> m_buffer;
        int m_encodedLength;
    };
    
} // namespace WebCore

#endif // ENABLE(TIMELAPSE)

#endif // ResourceDidReceiveData_h
