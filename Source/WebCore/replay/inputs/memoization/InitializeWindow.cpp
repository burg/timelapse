/*
 *  Copyright (C) 2012, Jake Bailey.
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

#if ENABLE(WEB_REPLAY)

#include "InitializeWindow.h"

#include "Document.h"
#include "DOMWindow.h"
#include "Frame.h"
#include "InputDecoder.h"
#include "InputEncoder.h"
#include "Page.h"
#include "ReplayController.h"
#include "ReplayInputTypes.h"
#include "UserInputProxy.h"
#include <wtf/text/StringConcatenate.h>

namespace WebCore {

void InitializeWindow::dispatch(ReplayController& controller, EventLoopInputDispatcher& dispatcher)
{
    ASSERT(sealed());

    controller.page()->mainFrame().document()->domWindow()->resizeTo((float) m_width, (float) m_height);
    dispatcher.didDispatch(this);
}

const AtomicString& InitializeWindow::type() const
{
    return inputTypes().InitializeWindow;
}

String InitializeWindow::toString() const
{
    return makeString("InitializeWindow(size=[", String::number(m_width), ",", String::number(m_height), "])");
}

PassOwnPtr<InitializeWindow> InitializeWindow::createFromPage(Page* page)
{
    int width = page->mainFrame().document()->domWindow()->outerWidth();
    int height = page->mainFrame().document()->domWindow()->outerHeight();
    return adoptPtr(new InitializeWindow(width, height));
}

void InputCoder<InitializeWindow>::encode(InputEncoder& encoder, const InitializeWindow& input)
{
    encoder.put("width", input.width());
    encoder.put("height", input.height());
}

bool InputCoder<InitializeWindow>::decode(InputDecoder& decoder, OwnPtr<InitializeWindow>& input)
{
    int width;
    if (!decoder.get("width", width))
        return false;

    int height;
    if (!decoder.get("height", height))
        return false;

    input = adoptPtr(new InitializeWindow(width, height));
    return true;
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
