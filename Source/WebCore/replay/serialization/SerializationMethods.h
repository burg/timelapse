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

#ifndef SerializationMethods_h
#define SerializationMethods_h

#if ENABLE(WEB_REPLAY)

#include "InputCoder.h"
#include <wtf/Vector.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

class FormData;
class FormDataElement;
class HTTPHeaderMap;
class ResourceError;
class ResourceLoadTiming;
class ResourceRequest;
class ResourceResponse;
class SharedBuffer;
class SubstituteData;

template<> struct InputCoder<Vector<String>> {
    static void encode(EncoderContext&, const Vector<String>& input);
    static bool decode(DecoderContext&, std::unique_ptr<Vector<String>>& input);
};

template<> struct InputCoder<SharedBuffer> {
    static void encode(EncoderContext&, const SharedBuffer& input);
    static bool decode(DecoderContext&, std::unique_ptr<SharedBuffer>& input);
};

template<> struct InputCoder<FormData> {
    static void encode(EncoderContext&, const FormData& input);
    static bool decode(DecoderContext&, std::unique_ptr<FormData>& input);
};

template<> struct InputCoder<FormDataElement> {
    static void encode(EncoderContext&, const FormDataElement& input);
    static bool decode(DecoderContext&, std::unique_ptr<FormDataElement>& input);
};

template<> struct InputCoder<SubstituteData> {
    static void encode(EncoderContext&, const SubstituteData& input);
    static bool decode(DecoderContext&, std::unique_ptr<SubstituteData>& input);
};

template<> struct InputCoder<HTTPHeaderMap> {
    static void encode(EncoderContext&, const HTTPHeaderMap& input);
    static bool decode(DecoderContext&, std::unique_ptr<HTTPHeaderMap>& input);
};

template<> struct InputCoder<ResourceError> {
    static void encode(EncoderContext&, const ResourceError& input);
    static bool decode(DecoderContext&, std::unique_ptr<ResourceError>& input);
};

template<> struct InputCoder<ResourceLoadTiming> {
    static void encode(EncoderContext&, const ResourceLoadTiming& input);
    static bool decode(DecoderContext&, std::unique_ptr<ResourceLoadTiming>& input);
};

template<> struct InputCoder<ResourceRequest> {
    static void encode(EncoderContext&, const ResourceRequest& input);
    static bool decode(DecoderContext&, std::unique_ptr<ResourceRequest>& input);
};

template<> struct InputCoder<ResourceResponse> {
    static void encode(EncoderContext&, const ResourceResponse& input);
    static bool decode(DecoderContext&, std::unique_ptr<ResourceResponse>& input);
};

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)

#endif // SerializationMethods_h
