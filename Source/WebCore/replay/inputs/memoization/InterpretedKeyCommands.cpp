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

#if ENABLE(WEB_REPLAY)

#include "EncoderContext.h"
#include "InterpretedKeyCommands.h"
#include "KeyboardEvent.h"
#include "ReplayInputTypes.h"
#include <wtf/text/StringBuilder.h>

namespace WebCore {

InterpretedKeyCommands::InterpretedKeyCommands(Vector<KeypressCommand>& commands)
    : m_commands(commands) {}

InterpretedKeyCommands::~InterpretedKeyCommands() {}

const AtomicString& InterpretedKeyCommands::type() const
{
    return inputTypes().InterpretedKeyCommands;
}

String InterpretedKeyCommands::toString() const
{
    StringBuilder sb;
    sb.append(String::format("InterpretedKeyCommands (n=%lu): [",
                             m_commands.size()));
    for (size_t i = 0; i < m_commands.size(); ++i) {
        if (i > 0)
            sb.append(",");
        sb.append(m_commands[i].commandName);
        sb.append(" -> ");
        sb.append(m_commands[i].text);
    }
    sb.append("]");
    return sb.toString();
}

size_t InterpretedKeyCommands::memorySize() const
{
    size_t size = sizeof(InterpretedKeyCommands);
    for (size_t i = 0; i < m_commands.size(); i++) {
        if (!m_commands[i].commandName.isEmpty())
            size += m_commands[i].commandName.impl()->cost();
        if (!m_commands[i].text.isEmpty())
            size += m_commands[i].text.impl()->cost();
    }
    return size;
}

void InputCoder<InterpretedKeyCommands>::encode(EncoderContext& encoder, const InterpretedKeyCommands& input)
{
    const Vector<KeypressCommand>& commands = input.commands();
    OwnPtr<EncoderContext> encodedCommands = encoder.createList();

    for (size_t i = 0; i < commands.size(); i++) {
        OwnPtr<EncoderContext> encodedCommand = encoder.createMap();
        encodedCommand->put("commandName", commands[i].commandName);
        encodedCommand->put("text", commands[i].text);
        encodedCommands->append(*encodedCommand);
    }

    encoder.put("commands", *encodedCommands);
}

bool InputCoder<InterpretedKeyCommands>::decode(DecoderContext&, OwnPtr<InterpretedKeyCommands>&)
{
    // TODO: implement
    return false;
}

} //namespace WebCore

#endif // ENABLE(WEB_REPLAY) && PLATFORM(MAC)
