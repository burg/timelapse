/*
 * Copyright (C) 2007 Apple Inc.  All rights reserved.
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
 * THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "config.h"
#include "DragImage.h"

#if ENABLE(DRAG_SUPPORT)

#include "Frame.h"
#include "FrameSelection.h"
#include "FrameSnapshot.h"
#include "FrameView.h"
#include "ImageBuffer.h"
#include "Page.h"
#include "Range.h"
#include "RenderObject.h"
#include "RenderView.h"

namespace WebCore {

DragImageRef fitDragImageToMaxSize(DragImageRef image, const IntSize& srcSize, const IntSize& size)
{
    float heightResizeRatio = 0.0f;
    float widthResizeRatio = 0.0f;
    float resizeRatio = -1.0f;
    IntSize originalSize = dragImageSize(image);

    if (srcSize.width() > size.width()) {
        widthResizeRatio = size.width() / (float)srcSize.width();
        resizeRatio = widthResizeRatio;
    }

    if (srcSize.height() > size.height()) {
        heightResizeRatio = size.height() / (float)srcSize.height();
        if ((resizeRatio < 0.0f) || (resizeRatio > heightResizeRatio))
            resizeRatio = heightResizeRatio;
    }

    if (srcSize == originalSize)
        return resizeRatio > 0.0f ? scaleDragImage(image, FloatSize(resizeRatio, resizeRatio)) : image;

    // The image was scaled in the webpage so at minimum we must account for that scaling
    float scalex = srcSize.width() / (float)originalSize.width();
    float scaley = srcSize.height() / (float)originalSize.height();
    if (resizeRatio > 0.0f) {
        scalex *= resizeRatio;
        scaley *= resizeRatio;
    }

    return scaleDragImage(image, FloatSize(scalex, scaley));
}

DragImageRef createDragImageForRange(Frame& frame, Range* range, bool forceBlackText)
{
    frame.view()->setPaintBehavior(PaintBehaviorSelectionOnly | (forceBlackText ? PaintBehaviorForceBlackText : 0));
    frame.document()->updateLayout();
    RenderView* view = frame.contentRenderer();
    if (!view)
        return nil;

    Position start = range->startPosition();
    Position candidate = start.downstream();
    if (candidate.deprecatedNode() && candidate.deprecatedNode()->renderer())
        start = candidate;

    Position end = range->endPosition();
    candidate = end.upstream();
    if (candidate.deprecatedNode() && candidate.deprecatedNode()->renderer())
        end = candidate;

    if (start.isNull() || end.isNull() || start == end)
        return nil;

    RenderObject* savedStartRenderer;
    int savedStartOffset;
    RenderObject* savedEndRenderer;
    int savedEndOffset;
    view->getSelection(savedStartRenderer, savedStartOffset, savedEndRenderer, savedEndOffset);

    RenderObject* startRenderer = start.deprecatedNode()->renderer();
    if (!startRenderer)
        return nil;

    RenderObject* endRenderer = end.deprecatedNode()->renderer();
    if (!endRenderer)
        return nil;

    view->setSelection(startRenderer, start.deprecatedEditingOffset(), endRenderer, end.deprecatedEditingOffset(), RenderView::RepaintNothing);
    DragImageRef result = createDragImageForRect(frame, view->selectionBounds(), false);
    view->setSelection(savedStartRenderer, savedStartOffset, savedEndRenderer, savedEndOffset, RenderView::RepaintNothing);

    frame.view()->setPaintBehavior(PaintBehaviorNormal);
    return result;
}

DragImageRef createDragImageForRect(Frame& frame, const IntRect& imageRect, bool includeSelection)
{
    OwnPtr<ImageBuffer> buffer = createImageFromFrameRect(frame, imageRect, includeSelection, true);
    RefPtr<Image> image = buffer->copyImage();
    return createDragImageFromImage(image.get(), ImageOrientationDescription());
}

DragImageRef createDragImageForImage(Frame& frame, Node* node, IntRect& imageRect, IntRect& elementRect)
{
    RenderObject* renderer = node->renderer();
    if (!renderer)
        return nullptr;

    renderer->updateDragState(true);    // mark dragged nodes (so they pick up the right CSS)
    frame.document()->updateLayout();  // forces style recalc - needed since changing the drag state might
                                        // imply new styles, plus JS could have changed other things


    // Document::updateLayout may have blown away the original RenderElement.
    renderer = node->renderer();
    if (!renderer)
        return nullptr;

    LayoutRect topLevelRect;
    IntRect paintingRect = pixelSnappedIntRect(renderer->paintingRootRect(topLevelRect));

    if (paintingRect.isEmpty())
        return nullptr;

    frame.view()->setNodeToDraw(node); // invoke special sub-tree drawing mode
    DragImageRef result = createDragImageForRect(frame, paintingRect);
    renderer->updateDragState(false);
    frame.document()->updateLayout();
    frame.view()->setNodeToDraw(nullptr);

    elementRect = pixelSnappedIntRect(topLevelRect);
    imageRect = paintingRect;
    return result;
}

#if !PLATFORM(WIN)
struct ScopedFramePaintingState {
    ScopedFramePaintingState(Frame& frame, Node* node)
    : frame(frame)
    , node(node)
    , paintBehavior(frame.view()->paintBehavior())
    , backgroundColor(frame.view()->baseBackgroundColor())
    {
        ASSERT(!node || node->renderer());
        if (node)
            node->renderer()->updateDragState(true);
    }

    ~ScopedFramePaintingState()
    {
        if (node && node->renderer())
            node->renderer()->updateDragState(false);
        frame.view()->setPaintBehavior(paintBehavior);
        frame.view()->setBaseBackgroundColor(backgroundColor);
        frame.view()->setNodeToDraw(nullptr);
    }

    Frame& frame;
    Node* node;
    PaintBehavior paintBehavior;
    Color backgroundColor;
};

DragImageRef createDragImageForFrameSelection(Frame& frame, bool forceBlackText)
{
    UNUSED_PARAM(forceBlackText);

    if (!frame.selection().isRange())
        return nullptr;

    const ScopedFramePaintingState state(frame, nullptr);
    frame.view()->setPaintBehavior(PaintBehaviorSelectionOnly | (forceBlackText ? PaintBehaviorForceBlackText : 0));
    frame.document()->updateLayout();

    IntRect paintingRect = enclosingIntRect(frame.selection().bounds());

    float deviceScaleFactor = 1;
    if (frame.page())
        deviceScaleFactor = frame.page()->deviceScaleFactor();
    paintingRect.setWidth(paintingRect.width() * deviceScaleFactor);
    paintingRect.setHeight(paintingRect.height() * deviceScaleFactor);

    OwnPtr<ImageBuffer> buffer(ImageBuffer::create(paintingRect.size(), deviceScaleFactor, ColorSpaceDeviceRGB));
    if (!buffer)
        return nullptr;
    buffer->context()->translate(-paintingRect.x(), -paintingRect.y());
    buffer->context()->clip(FloatRect(0, 0, paintingRect.maxX(), paintingRect.maxY()));

    frame.view()->paintContents(buffer->context(), paintingRect);

    RefPtr<Image> image = buffer->copyImage();
    return createDragImageFromImage(image.get(), ImageOrientationDescription());
}

DragImageRef createDragImageForNode(Frame& frame, Node* node)
{
    if (!node->renderer())
        return nullptr;

    const ScopedFramePaintingState state(frame, node);

    frame.view()->setPaintBehavior(state.paintBehavior | PaintBehaviorFlattenCompositingLayers);

    // When generating the drag image for an element, ignore the document background.
    frame.view()->setBaseBackgroundColor(Color::transparent);
    frame.document()->updateLayout();
    frame.view()->setNodeToDraw(node); // Enable special sub-tree drawing mode.

    // Document::updateLayout may have blown away the original renderer.
    auto renderer = node->renderer();
    if (!renderer)
        return nullptr;

    LayoutRect topLevelRect;
    IntRect paintingRect = pixelSnappedIntRect(renderer->paintingRootRect(topLevelRect));

    float deviceScaleFactor = 1;
    if (frame.page())
        deviceScaleFactor = frame.page()->deviceScaleFactor();
    paintingRect.setWidth(paintingRect.width() * deviceScaleFactor);
    paintingRect.setHeight(paintingRect.height() * deviceScaleFactor);

    OwnPtr<ImageBuffer> buffer(ImageBuffer::create(paintingRect.size(), deviceScaleFactor, ColorSpaceDeviceRGB));
    if (!buffer)
        return nullptr;
    buffer->context()->translate(-paintingRect.x(), -paintingRect.y());
    buffer->context()->clip(FloatRect(0, 0, paintingRect.maxX(), paintingRect.maxY()));

    frame.view()->paintContents(buffer->context(), paintingRect);

    RefPtr<Image> image = buffer->copyImage();

    ImageOrientationDescription orientationDescription(renderer->shouldRespectImageOrientation());
#if ENABLE(CSS_IMAGE_ORIENTATION)
    orientationDescription.setImageOrientationEnum(renderer->style()->imageOrientation());
#endif
    return createDragImageFromImage(image.get(), orientationDescription);
}
#endif // !PLATFORM(WIN)

#if !PLATFORM(MAC) && (!PLATFORM(WIN) || OS(WINCE))
DragImageRef createDragImageForLink(URL&, const String&, FontRenderingMode)
{
    return nullptr;
}
#endif

} // namespace WebCore

#endif // ENABLE(DRAG_SUPPORT)
