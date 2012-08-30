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

#include "InterpretedKeyCommands.h"
#include <wtf/text/StringBuilder.h>
#include <wtf/timelapse/ActionSerializer.h>

namespace WebKit {

namespace ReplayableTypes {
const char* InterpretedKeyCommands = "InterpretedKeyCommands";
} // namespace ReplayableTypes

InterpretedKeyCommands::InterpretedKeyCommands(Vector<WebCore::KeypressCommand>& commands)
    : ReplayableAction(ReplayableTypes::InterpretedKeyCommands)
    , m_commands(commands) {}

InterpretedKeyCommands::~InterpretedKeyCommands() {}

String InterpretedKeyCommands::toString() const
{
    StringBuilder sb;
    sb.append(String::format("InterpretedKeyCommands (n=%lu): [\n",
                             m_commands.size()));
    for (size_t i = 0; i < m_commands.size(); ++i) {
        sb.append(m_commands[i].commandName);
        sb.append("\t --> ");
        sb.append(m_commands[i].text);
        sb.append("\n");
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

void InterpretedKeyCommands::serialize(ActionSerializer* serializer) const
{
    serializer->pushArray();
    for (size_t i = 0; i < m_commands.size(); i++) {
        serializer->pushObject();
        serializer->putString("commandName", m_commands[i].commandName);
        serializer->putString("text", m_commands[i].text);
        serializer->popObjectAsElement();
    }
    
    serializer->popArrayAsProperty("commands");
}

} //namespace WebKit

