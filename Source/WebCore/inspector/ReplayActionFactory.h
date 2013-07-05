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

#ifndef ReplayActionFactory_h
#define ReplayActionFactory_h

#if ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#include <wtf/PassRefPtr.h>

namespace WebCore {

class DocumentLoader;
class InspectorObject;
class PlatformMouseEvent;
class PlatformKeyboardEvent;
class PlatformWheelEvent;
class ResourceDidFinishLoading;
class ResourceDidReceiveData;
class ResourceDidReceiveResponse;
class ResourceWillSendRequest;
class ScrollPage;
class SendResizeEvent;

class ReplayActionFactory {
public:
    static PassRefPtr<InspectorObject> createMouseData(const PlatformMouseEvent&);
    static PassRefPtr<InspectorObject> createWheelData(const PlatformWheelEvent&);
    static PassRefPtr<InspectorObject> createKeyPressData(const PlatformKeyboardEvent&);
    static PassRefPtr<InspectorObject> createScrollData(const ScrollPage&);
    static PassRefPtr<InspectorObject> createResizeData(const SendResizeEvent&);

    static PassRefPtr<InspectorObject> createEmptyData();

    static PassRefPtr<InspectorObject> createRequestResourceData(const ResourceWillSendRequest&);
    static PassRefPtr<InspectorObject> createReceiveResponseData(const ResourceDidReceiveResponse&);
    static PassRefPtr<InspectorObject> createReceiveDataData(const ResourceDidReceiveData&);
    static PassRefPtr<InspectorObject> createResourceLoadedData(const ResourceDidFinishLoading&);

    static PassRefPtr<InspectorObject> createFrameNavigatedData(DocumentLoader*);


private:
    ReplayActionFactory() { }
};

} // namespace WebCore

#endif // ENABLE(INSPECTOR) && ENABLE(WEB_REPLAY)

#endif // ReplayActionFactory_h
