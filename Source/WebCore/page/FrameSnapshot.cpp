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


#include "config.h"

#include "FrameSnapshot.h"

#include "Document.h"
#include "Frame.h"
#include "FrameView.h"
#include "ImageBuffer.h"
#include "Page.h"

namespace WebCore {

FrameSnapshot::FrameSnapshot(OwnPtr<ImageBuffer> buffer)
: m_buffer(buffer.release()) {}

FrameSnapshot::~FrameSnapshot() {}

std::unique_ptr<FrameSnapshot> FrameSnapshot::createFromRect(Frame& frame, const IntRect& imageRect, bool includeSelection, bool useViewCoordinates)
{
    return std::make_unique<FrameSnapshot>(createImageFromFrameRect(frame, imageRect, includeSelection, useViewCoordinates).release());
}

OwnPtr<ImageBuffer> createImageFromFrameRect(Frame& frame, const IntRect& imageRect, bool includeSelection, bool useViewCoordinates)
{
    frame.document()->updateLayout();

    IntRect usedRect(imageRect);
    float deviceScaleFactor = 1;
    if (frame.page())
        deviceScaleFactor = frame.page()->deviceScaleFactor();
    usedRect.setWidth(imageRect.width() * deviceScaleFactor);
    usedRect.setHeight(imageRect.height() * deviceScaleFactor);

    OwnPtr<ImageBuffer> buffer = ImageBuffer::create(usedRect.size(), deviceScaleFactor, ColorSpaceDeviceRGB);
    if (!buffer)
        return nullptr;
    buffer->context()->translate(-usedRect.x(), -usedRect.y());
    buffer->context()->clip(FloatRect(0, 0, usedRect.maxX(), usedRect.maxY()));

    FrameView::SelectionInSnapshot selectionMode = includeSelection ? FrameView::IncludeSelection : FrameView::ExcludeSelection;
    FrameView::CoordinateSpaceForSnapshot coordinateMode = useViewCoordinates ? FrameView::ViewCoordinates : FrameView::DocumentCoordinates;
    frame.view()->paintContentsForSnapshot(buffer->context(), usedRect, selectionMode, coordinateMode);
    return buffer.release();
}

String FrameSnapshot::toDataURL(const String& mimeType, double* quality)
{
    return buffer().toDataURL(mimeType, quality);
}

} // namespace WebCore
