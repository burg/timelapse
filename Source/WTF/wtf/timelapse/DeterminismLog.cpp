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

#include "DeterminismLog.h"

#include "ActionSerializer.h"
#include "CString.h"
#include "ReplayableAction.h"
#include "Vector.h"
#include "WTFString.h"
#include "StringBuilder.h"

namespace WTF {

#if !LOG_DISABLED

#ifndef LOG_CHANNEL_PREFIX
#define LOG_CHANNEL_PREFIX Log
#endif

WTFLogChannel LogTimelapseCapturing =  { 0x00000001, "", WTFLogChannelOn  };
#endif

DeterminismLog::DeterminismLog(bool capturing, bool replaying)
: m_memoizedActions(Vector<ActionEntry>()) //TODO: default capacity?
, m_dispatchActions(Vector<ActionEntry>())
, m_isCapturing(capturing)
, m_isReplaying(replaying)
, m_active(true)
, m_errorType(NoError)
, m_memoizedReplayPosition(0)
, m_dispatchReplayPosition(0)
, m_captureCount(0) {}

DeterminismLog::~DeterminismLog()
{
    //assume ownership of all actions in the vector, so must
    //delete them in the destructor.
    for (Vector<ActionEntry>::iterator it = m_memoizedActions.begin(); it != m_memoizedActions.end(); it++)
        delete it->action;
    for (Vector<ActionEntry>::iterator it = m_dispatchActions.begin(); it != m_dispatchActions.end(); it++)
        delete it->action;
}

//make object creation redirect through here. This will make it easier
//to deserialize logs from file in the future, by calling a 
//different factory method
PassRefPtr<DeterminismLog> DeterminismLog::createLogForCapture()
{
    DeterminismLog* newLog = new DeterminismLog(true, false);
    LOG(TimelapseCapturing, "%-30s CAPTURE START\n", "[DeterminismLog]");
                
    return adoptRef(newLog);
}

void DeterminismLog::endCapturing()
{
    ASSERT(m_isCapturing);
    m_isCapturing = false;

    m_memoizedActions.shrinkToFit();
    m_dispatchActions.shrinkToFit();

    LOG(TimelapseCapturing, "%-30s CAPTURE STOP\n", "[DeterminismLog]");
}

void DeterminismLog::append(ReplayableAction* action)
{
    ASSERT_ARG(action, action != NULL);
    ASSERT(m_active);
    ASSERT(m_isCapturing && !m_isReplaying);

    ActionEntry newEntry = ActionEntry(action, m_captureCount++);

    LOG(TimelapseCapturing, "%-25s#%-5ld CAPTURE: %s \n",
        "[DeterminismLog]",
        newEntry.count, action->toString().utf8().data());

    if (action->dispatchable())
        m_dispatchActions.append(newEntry);
    else
        m_memoizedActions.append(newEntry);
}

String DeterminismLog::errorMessage() const
{
    ASSERT(hasError());
    StringBuilder sb;
    
    switch (m_errorType) {
    case ErrorExhaustedMemoizedInput:
        sb.append("Ran out of memoized data because too much was requested.");
        break;

    case ErrorUnexpectedActionType: {
        sb.append("Expected next memoized input to be a ");
        sb.append(m_errorData.expectedActionType);
        sb.append(", but found a ");
      
        const ActionEntry& entry = m_memoizedActions.at(m_memoizedReplayPosition);
        ReplayableAction* thisAction = entry.action;

        sb.append(thisAction->type());
        sb.append("(detail: ");
        sb.append(thisAction->toString());
        sb.append(")");
        break;
    }
    default:
        break;
    }
    
    return sb.toString();
}

void DeterminismLog::reset()
{
    ASSERT(!m_isCapturing);

    LOG(TimelapseCapturing, "%-30s RESET\n", "[DeterminismLog]");

    m_memoizedReplayPosition = 0;
    m_dispatchReplayPosition = 0;
    m_isReplaying = true;
    m_active = true;
    m_errorType = NoError;
    // TODO: deallocate anything stuck inside m_errorData
    m_isCapturing = false;
}

ReplayableAction* DeterminismLog::currentAction(ReplayableAction::ReplayableType type)
{   
    ASSERT(m_isReplaying);
    ASSERT(isActive());
    
    if (m_memoizedReplayPosition >= m_memoizedActions.size()) {
        LOG_ERROR("No more memoized inputs remain, but one was requested.");
        m_errorType = ErrorExhaustedMemoizedInput;
        return 0;
    }
    
    const ActionEntry& entry = m_memoizedActions.at(m_memoizedReplayPosition);

    //NOTE: in general, it is not the case that 
    //m_dispatchReplayPosition + m_memoizedReplayPosition == entry.count;
    //the determinism log client may want to fetch a dispatch action before
    //it is actually needed (i.e., ahead of some memoized data) and vice-versa.

    ReplayableAction* thisAction = entry.action;

    if (!thisAction->hasType(type)) {
        LOG_ERROR("%-30s ERROR %p != %p\n", "[DeterminismLog]", type, thisAction->type());
        LOG_ERROR("%-25s#%-5ld Expected replay action of type %s, but got type %s (%s)\n",
                  "[DeterminismLog]",
                  entry.count, type, thisAction->type(), thisAction->toString().ascii().data());
        
        m_errorType = ErrorUnexpectedActionType;
        m_errorData.expectedActionType = type;
        return 0;
    } else {
        LOG(TimelapseCapturing, "%-25s#%-5ld YIELD: %s\n", "[DeterminismLog]",
            entry.count, thisAction->toString().utf8().data());
    }

    m_memoizedReplayPosition++;

    return thisAction;
}

ReplayableAction* DeterminismLog::currentDispatchableAction()
{
    ASSERT(m_isReplaying);
    ASSERT(isActive());
    // callers should check for errors before requesting dispatchable actions.
    // if an error exists, the caller should call reset() or clearError()
    ASSERT(!hasError());
    if (m_dispatchReplayPosition >= m_dispatchActions.size()) {
        LOG_ERROR("No more dispatchable actions remain, but one was requested.");
        m_errorType = ErrorExhaustedDispatchableActions;
        return 0;
    }

    const ActionEntry& entry = m_dispatchActions.at(m_dispatchReplayPosition);

    LOG(TimelapseCapturing, "%-25s#%-5ldYIELD: %s\n", "[DeterminismLog]",
        entry.count, entry.action->toString().utf8().data());

    m_dispatchReplayPosition++;

    return entry.action;
}

void DeterminismLog::setIsActive(bool state)
{
    ASSERT(m_active != state);
    m_active = state;
}

size_t DeterminismLog::memorySize() const
{
    size_t count = 0;
    for (size_t i = 0; i < m_memoizedActions.size(); i++)
        count += m_memoizedActions[i].action->memorySize();

    for (size_t i = 0; i < m_dispatchActions.size(); i++)
        count += m_dispatchActions[i].action->memorySize();
    return count;
}
    
void DeterminismLog::serialize(ActionSerializer* serializer) const
{

    /* the overall recording has the form:
    {
      metadata: {
                  memorySize: ...,
                  ...
      },
      actions: [ { ... }, { ... }, ... ]
    }*/
    
    serializer->pushObject();
    // TODO: add other recording metadata?
    serializer->putInt("memorySize", memorySize());
    serializer->popObjectAsProperty("metadata");
    
    serializer->pushArray();
    // memoizedActions offset
    size_t i = 0;
    // dispatchActions offset
    size_t j = 0;
    
    
    /* each action has the form:
    {
      metadata: { 
                 "type":   ...,
                 "number": ...,
                ...
      },
      action: { 
                "foo": ...,
                ...
      }
    }*/
    
    for (size_t count = 0; count < m_captureCount; count++) {
        serializer->pushObject();
        
        ReplayableAction* action;
        if (i == m_memoizedActions.size())
            action = m_dispatchActions[j++].action;
        else if (j == m_dispatchActions.size())
            action = m_memoizedActions[i++].action;
        else if (m_memoizedActions[i].count < m_dispatchActions[j].count)
            action = m_memoizedActions[i++].action;
        else
            action = m_dispatchActions[j++].action;
        
        LOG(TimelapseCapturing, "%-25s Writing %5zu: %s\n", "[DeterminismLog]",
                                count, action->type());

        serializer->pushObject();
        serializer->putString("type", action->type());
        serializer->putInt("number", count);
        if (action->dispatchable())
            action->serializeDispatchInfo(serializer);
        serializer->popObjectAsProperty("metadata");
        
        serializer->pushObject();
        action->serialize(serializer);
        serializer->popObjectAsProperty("action");
        
        serializer->popObjectAsElement();
    }
    serializer->popArrayAsProperty("actions");
}
    
}; // namespace WTF
