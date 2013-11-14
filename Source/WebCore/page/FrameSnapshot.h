/*
 *  Copyright (C) 2013 University of Washington. All rights reserved.
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

#ifndef FrameSnapshot_h
#define FrameSnapshot_h

#include <wtf/OwnPtr.h>
#include <wtf/text/WTFString.h>

namespace WebCore {

class Frame;
class IntRect;
class ImageBuffer;
class Node;

// Used to take both screenshots and images for DragImage.
OwnPtr<ImageBuffer> createImageFromFrameRect(Frame&, const IntRect&, bool includeSelection = true, bool useViewCoordinates = true);

// This class hides the implementation of FrameSnapshot::toDataURL from embedders.
class FrameSnapshot {
public:
    FrameSnapshot(OwnPtr<ImageBuffer>);
    ~FrameSnapshot();
    static std::unique_ptr<FrameSnapshot> createFromRect(Frame&, const IntRect&, bool includeSelection = true, bool useViewCoordinates = true);

    String toDataURL(const String& mimeType, double* quality = nullptr);
    ImageBuffer& buffer() const { return *m_buffer; }
private:

    OwnPtr<ImageBuffer> m_buffer;
};

} // namespace WebCore

#endif // FrameSnapshot_h
