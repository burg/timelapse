/*
 *  Copyright (C) 2011, 2012 Brian Burg.
 *  Copyright (C) 2011, 2012 University of Washington. All rights reserved.
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

static const char* queueTypeToMiniString(DeterminismQueueType queue) {
    switch (queue) {
        case DispatchableActionQueue:    return "DSPTCH";
        case LoaderMemoizedDataQueue:    return "LDMEMO";
        case ScriptMemoizedDataQueue:    return "JSMEMO";
        case DeterminismQueueTypeLength: return "ERROR!";
    }
}
#endif

static const char* queueTypeToString(DeterminismQueueType queue) {
    switch (queue) {
        case DispatchableActionQueue:    return "DispatchableActionQueue";
        case LoaderMemoizedDataQueue:    return "LoaderMemoizedDataQueue";
        case ScriptMemoizedDataQueue:    return "ScriptMemoizedDataQueue";
        case DeterminismQueueTypeLength: return "QueueTypeLength (error)";
    }
}

DeterminismLog::DeterminismLog(bool capturing, bool replaying)
: m_isCapturing(capturing)
, m_isReplaying(replaying)
, m_active(true)
, m_captureCount(0) {

    m_errorData.error = NoError;

    for (size_t i = 0; i < DeterminismQueueTypeLength; i++) {
        m_positions.append(0);
        m_queues.append(DeterminismQueue());
    }
}

DeterminismLog::~DeterminismLog()
{
    //the log assumes ownership of all actions in queues, so must
    //delete them in the destructor.
    for (size_t i = 0; i < m_queues.size(); i++) {
        for (DeterminismQueue::iterator it = m_queues[i].begin(); it != m_queues[i].end(); it++)
            delete it->action;
    }
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

    for (size_t i = 0; i < m_queues.size(); i++)
        m_queues[i].shrinkToFit();
    
    LOG(TimelapseCapturing, "%-30s CAPTURE STOP\n", "[DeterminismLog]");
}

void DeterminismLog::append(ReplayableAction* action)
{
    ASSERT_ARG(action, action != NULL);
    ASSERT(m_active);
    ASSERT(m_isCapturing && !m_isReplaying);
    ASSERT(action->queue() < DeterminismQueueTypeLength);

    ActionEntry newEntry = ActionEntry(action, m_captureCount++);

    LOG(TimelapseCapturing, "%-25s#%-5ld %s-CAPTURE: %s \n",
        "[DeterminismLog]",
        newEntry.count,
        queueTypeToMiniString(action->queue()),
        action->toString().utf8().data());

    m_queues[action->queue()].append(newEntry);
}

String DeterminismLog::errorMessage() const
{
    ASSERT(hasError());
    StringBuilder sb;
    
    switch (m_errorData.error) {
    case ErrorExhaustedQueue:
        ASSERT(m_errorData.queue < DeterminismQueueTypeLength);
        sb.append("Ran out of actions on queue: ");
        sb.append(queueTypeToString(m_errorData.queue));
        sb.append(" because too many were requested.");
        break;

    case ErrorUnexpectedActionType: {
        DeterminismQueueType queue = m_errorData.queue;
        ASSERT(queue < DeterminismQueueTypeLength);
        sb.append("Expected next input to be a ");
        sb.append(m_errorData.expectedAction);
        sb.append(", but found a ");
      

        const ActionEntry& entry = m_queues[queue].at(m_positions[queue]);
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

    for (size_t i = 0; i < m_positions.size(); i++)
        m_positions[i] = 0;

    m_isReplaying = true;
    m_active = true;
    m_errorData.error = NoError;
    // TODO: deallocate anything stuck inside m_errorData
    m_isCapturing = false;
}

ReplayableAction* DeterminismLog::popExpectedAction(DeterminismQueueType queue,
                                                    ReplayableAction::ReplayableType type)
{
    if (hasError()) {
        LOG_ERROR("%-30s prior memoized value retrieval failed, so not consulting log and instead propagating error condition.",
                  "DeterminismLog::popExpectedAction");
        return 0;
    }
   
    ReplayableAction* action = popAction(queue);

    if (action->type() != type) {
        LOG_ERROR("%-30s ERROR %p != %p\n", "[DeterminismLog]", type, action->type());
        LOG_ERROR("%-25s Expected replay action of type %s, but got type %s (%s)\n",
                  "[DeterminismLog]",
                  type, action->type(), action->toString().ascii().data());
        
        m_errorData.error = ErrorUnexpectedActionType;
        m_errorData.expectedAction = type;
        return 0;
    }

    return action;
}

ReplayableAction* DeterminismLog::popAction(DeterminismQueueType queue)
{
    ASSERT(m_isReplaying);
    ASSERT(isActive());
    // callers should check for errors before requesting actions.
    // if an error exists, the caller should call reset() or clearError()
    ASSERT(!hasError());
    ASSERT(queue < DeterminismQueueTypeLength);
    
    if (m_positions[queue] >= m_queues[queue].size()) {
        LOG_ERROR("%-30s ERROR No more inputs remain for determinism queue %s, but one was requested.",
                  "[DeterminismLog]",
                  queueTypeToString(queue));
        m_errorData.error = ErrorExhaustedQueue;
        m_errorData.queue = queue;
        return 0;
    }
    
    const ActionEntry& entry = m_queues[queue].at(m_positions[queue]);

    LOG(TimelapseCapturing, "%-25s#%-5ld %s-YIELD: %s\n", "[DeterminismLog]",
            entry.count, queueTypeToMiniString(queue),
            entry.action->toString().utf8().data());

    m_positions[queue] += 1;
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
    for (size_t i = 0; i < DeterminismQueueTypeLength; i++) {
        for (size_t j = 0; j < m_queues[i].size(); j++)
            count += m_queues[i].at(j).action->memorySize();
    }

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
      queues: [ { 'name': 'foo', actions: [ { ... }, { ... }, ... ] } ]
    }*/
    
    serializer->pushObject(); // the entire recording object
    // TODO: add other recording metadata?
    serializer->putInt("memorySize", memorySize());
    serializer->popObjectAsProperty("metadata");
    
    serializer->pushArray(); // array of queues
    
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
    
    for (size_t queue = 0; queue < m_queues.size(); queue++) {
        serializer->pushObject(); // a single queue object
    
        serializer->putString("name", queueTypeToString((DeterminismQueueType)queue));
        serializer->pushArray(); // array of action objects
        
        for (size_t i = 0; i < m_queues[queue].size(); i++) {
            const ActionEntry& entry = m_queues[queue].at(i);
            LOG(TimelapseCapturing, "%-25s Writing %5zu: %s\n", "[DeterminismLog]",
                                    entry.count, entry.action->type());
            serializer->pushObject(); // a single action object

            serializer->pushObject(); // action object's metadata
            serializer->putString("type", entry.action->type());
            serializer->putInt("number", entry.count);
            if (entry.action->queue() == DispatchableActionQueue)
                entry.action->serializeDispatchInfo(serializer);
            serializer->popObjectAsProperty("metadata");
        
            serializer->pushObject(); // action object's main data
            entry.action->serialize(serializer);
            serializer->popObjectAsProperty("action");
        
            serializer->popObjectAsElement(); // a single action object
        }
        
        serializer->popArrayAsProperty("actions");
        serializer->popObjectAsElement();
    }
    serializer->popArrayAsProperty("queues");
}
    
}; // namespace WTF
