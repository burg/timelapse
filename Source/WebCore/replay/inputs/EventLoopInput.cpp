/*
 *  Copyright (C) 2011, Brian Burg.
 *  Copyright (C) 2011, University of Washington. All rights reserved.
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

#if ENABLE(WEB_REPLAY)

#include "EventLoopInput.h"

#include "Document.h"
#include "EncoderContext.h"
#include "FrameTree.h"
#include "MainFrame.h"
#include "Page.h"
#include <wtf/Assertions.h>

namespace WebCore {

int frameIndexFromDocument(Document* document)
{
    ASSERT(document);
    ASSERT(document->frame());
    return frameIndexFromFrame(document->frame());
}

int frameIndexFromFrame(Frame* targetFrame)
{
    ASSERT(targetFrame);

    int index = 0;
    Frame* mainFrame = &targetFrame->tree().top();
    for (Frame* frame = mainFrame; frame; index++, frame = frame->tree().traverseNext(mainFrame))
        if (frame == targetFrame)
            return index;

    ASSERT_NOT_REACHED();
    return 0;
}

Document* documentFromFrameIndex(Page* page, int frameIndex)
{
    Frame* frame = frameFromFrameIndex(page, frameIndex);
    return frame ? frame->document() : nullptr;
}

Frame* frameFromFrameIndex(Page* page, int frameIndex)
{
    ASSERT(page);
    ASSERT(frameIndex >= 0);

    Frame* mainFrame = &page->mainFrame();
    Frame* frame = mainFrame;
    int idx = 0;
    for (; idx < frameIndex && frame; idx++, frame = frame->tree().traverseNext(mainFrame));
    return frame;
}

void EventLoopInput::serializeDispatchInfo(EncoderContext& encoder) const
{
    encoder.put("domEventQuota", m_executionTicksQuota);
    encoder.put("markIndex", m_mark.index());
    encoder.put("markTimestamp", m_mark.time());
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
