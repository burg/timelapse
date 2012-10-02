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

#include "config.h"
#include "TimelapseRecordFactory.h"

#if ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)

#include "DocumentLoader.h"
#include "Frame.h"
#include "FrameTree.h"
#include "InspectorValues.h"
#include "ScrollPage.h"
#include "SendResizeEvent.h"
#include "PlatformKeyboardEvent.h"
#include "PlatformMouseEvent.h"
#include "PlatformWheelEvent.h"
#include "ResourceDidFinishLoading.h"
#include "ResourceDidReceiveData.h"
#include "ResourceDidReceiveResponse.h"
#include "ResourceWillSendRequest.h"

namespace WebCore {

PassRefPtr<InspectorObject> TimelapseRecordFactory::createMouseData(const PlatformMouseEvent& event)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("x", event.position().x());
    data->setNumber("y", event.position().y());
    data->setNumber("button", event.button());
    data->setBoolean("shiftKey", event.shiftKey());
    data->setBoolean("ctrlKey", event.ctrlKey());
    data->setBoolean("altKey", event.altKey());
    data->setBoolean("metaKey", event.metaKey());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createWheelData(const PlatformWheelEvent& event)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("x", event.position().x());
    data->setNumber("y", event.position().y());
    data->setBoolean("shiftKey", event.shiftKey());
    data->setBoolean("ctrlKey", event.ctrlKey());
    data->setBoolean("altKey", event.altKey());
    data->setBoolean("metaKey", event.metaKey());
    data->setNumber("deltaX", event.deltaX());
    data->setNumber("deltaY", event.deltaY());
    data->setNumber("ticksX", event.wheelTicksX());
    data->setNumber("ticksY", event.wheelTicksY());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createKeyPressData(const PlatformKeyboardEvent& event)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setString("text", event.text());
    data->setBoolean("shiftKey", event.shiftKey());
    data->setBoolean("ctrlKey", event.ctrlKey());
    data->setBoolean("altKey", event.altKey());
    data->setBoolean("metaKey", event.metaKey());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createScrollData(ScrollPage* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setBoolean("logical", action->isLogicalScroll());
    if (action->isLogicalScroll())
        data->setString("direction", ScrollPage::logicalScrollDirectionToString(action->logicalScrollDirection()));
    else
        data->setString("direction", ScrollPage::scrollDirectionToString(action->scrollDirection()));
    data->setString("granularity", ScrollPage::scrollGranularityToString(action->scrollGranularity()));
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createResizeData(SendResizeEvent* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("width", action->width());
    data->setNumber("height", action->height());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createEmptyData()
{
    return InspectorObject::create();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createRequestResourceData(ResourceWillSendRequest* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("id", action->id());
    data->setString("url", action->request()->url().string());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createReceiveResponseData(ResourceDidReceiveResponse* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("id", action->id());
    data->setString("url", action->response()->url().string());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createReceiveDataData(ResourceDidReceiveData* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("id", action->id());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createResourceLoadedData(ResourceDidFinishLoading* action)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setNumber("id", action->id());
    return data.release();
}

PassRefPtr<InspectorObject> TimelapseRecordFactory::createFrameNavigatedData(DocumentLoader* loader)
{
    RefPtr<InspectorObject> data = InspectorObject::create();
    data->setString("url", loader->url().string());
    data->setString("name", loader->frame()->tree()->name());
    return data.release();
}

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(TIMELAPSE)
