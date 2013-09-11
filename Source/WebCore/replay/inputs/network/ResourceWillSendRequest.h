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

#ifndef ResourceWillSendRequest_h
#define ResourceWillSendRequest_h

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"
#include "InputCoder.h"
#include "ResourceResponse.h"
#include "ResourceRequest.h"

namespace WebCore {

class ReplayController;

class ResourceWillSendRequest : public EventLoopInput {
public:
    ResourceWillSendRequest(int id, ResourceRequest&, const ResourceResponse& redirectResponse);
    ResourceWillSendRequest(int id, PassOwnPtr<ResourceRequest>, PassOwnPtr<ResourceResponse> redirectResponse);
    virtual ~ResourceWillSendRequest();

    // EventLoopInput API
    virtual void dispatch(ReplayController&, EventLoopInputDispatcher&) OVERRIDE;

    // NondeterministicInput API
    virtual const AtomicString& type() const OVERRIDE;
    virtual String toString() const OVERRIDE;
    virtual size_t memorySize() const OVERRIDE;

    int handleId() const { return m_handleId; }
    const ResourceRequest& request() const { return *m_request; }
    const ResourceResponse& redirectResponse() const { return *m_redirectResponse; }
private:
    int m_handleId;
    OwnPtr<ResourceRequest> m_request;
    OwnPtr<ResourceResponse> m_redirectResponse;
};

template<> struct InputCoder<ResourceWillSendRequest> {
    static void encode(InputEncoder& encoder, const ResourceWillSendRequest& input);
    static bool decode(InputDecoder& decoder, OwnPtr<ResourceWillSendRequest>& input);
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // ResourceWillSendRequest_h
