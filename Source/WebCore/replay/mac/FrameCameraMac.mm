/*
 *  Copyright (C) 2013, Jake Bailey.
 *  Copyright (C) 2013, University of Washington. All rights reserved.
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

#if ENABLE(TIMELAPSE)

#include "FrameCamera.h"
#include "Logging.h"
#include <wtf/text/Base64.h>

namespace WebCore {

String FrameCamera::dataUriImageFromFrame(Frame* frame)
{
    NSRect imageSize = NSMakeRect(0.0, 0.0, 200.0, 200.0);
    NSImage* image = frame->imageFromRect(imageSize);
    NSBitmapImageRep* imageRep = [[NSBitmapImageRep alloc] initWithData: [image TIFFRepresentation]];
    NSData* pngData = [imageRep representationUsingType: NSPNGFileType
                                             properties: [NSDictionary dictionary]];

    String encodedImage = base64Encode(reinterpret_cast<const char *>([pngData bytes]), [pngData length]);
    String dataUri = "url(\"data:image/png;base64,";
    dataUri.append(encodedImage);
    dataUri.append("\")");

    LOG(DeterministicReplay, "%-30s Captured image: %s", "[FrameCamera]", dataUri.utf8().data());
    return dataUri;
}

} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
