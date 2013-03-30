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

#include "ReplayInputLog.h"

#include "CString.h"
#include "NondeterministicInput.h"
#include "StringBuilder.h"
#include "Vector.h"
#include "WTFString.h"

namespace WTF {

#if !LOG_DISABLED

#ifndef LOG_CHANNEL_PREFIX
#define LOG_CHANNEL_PREFIX Log
#endif

WTFLogChannel LogTimelapseCapturing =  { 0x00000001, "", WTFLogChannelOn  };

static const char* queueTypeToMiniString(ReplayInputQueueType queue) {
    switch (queue) {
        case EventLoopInputQueue:        return "DSPTCH";
        case LoaderMemoizedDataQueue:    return "LDMEMO";
        case ScriptMemoizedDataQueue:    return "JSMEMO";
        case ReplayInputQueueTypeLength: return "ERROR!";
    }
}
#endif

static const char* queueTypeToString(ReplayInputQueueType queue) {
    switch (queue) {
        case EventLoopInputQueue:        return "EventLoopInputQueue";
        case LoaderMemoizedDataQueue:    return "LoaderMemoizedDataQueue";
        case ScriptMemoizedDataQueue:    return "ScriptMemoizedDataQueue";
        case ReplayInputQueueTypeLength: return "QueueTypeLength (error)";
    }
}

ReplayInputLog::ReplayInputLog(bool capturing, bool replaying)
: m_isCapturing(capturing)
, m_isReplaying(replaying)
, m_active(true)
, m_captureCount(0) {

    m_errorData.error = NoError;

    for (size_t i = 0; i < ReplayInputQueueTypeLength; i++) {
        m_positions.append(0);
        m_queues.append(DeterminismQueue());
    }
}

ReplayInputLog::~ReplayInputLog()
{
    //the log assumes ownership of all inputs in queues, so must
    //delete them in the destructor.
    for (size_t i = 0; i < m_queues.size(); i++) {
        for (DeterminismQueue::iterator it = m_queues[i].begin(); it != m_queues[i].end(); it++)
            delete it->input;
    }
}

//make object creation redirect through here. This will make it easier
//to deserialize logs from file in the future, by calling a 
//different factory method
PassOwnPtr<ReplayInputLog> ReplayInputLog::createForCapture()
{
    ReplayInputLog* newLog = new ReplayInputLog(true, false);
    LOG(TimelapseCapturing, "%-30s CAPTURE START\n", "[ReplayInputLog]");
                
    return adoptPtr(newLog);
}

void ReplayInputLog::endCapturing()
{
    ASSERT(m_isCapturing);
    m_isCapturing = false;

    for (size_t i = 0; i < m_queues.size(); i++)
        m_queues[i].shrinkToFit();
    
    LOG(TimelapseCapturing, "%-30s CAPTURE STOP\n", "[ReplayInputLog]");
}

void ReplayInputLog::append(NondeterministicInput* input)
{
    ASSERT_ARG(input, input != NULL);
    ASSERT(m_active);
    ASSERT(m_isCapturing && !m_isReplaying);
    ASSERT(input->queue() < ReplayInputQueueTypeLength);

    InputEntry newEntry = InputEntry(input, m_captureCount++);

    LOG(TimelapseCapturing, "%-25s#%-5ld %s-CAPTURE: %s \n",
        "[ReplayInputLog]",
        newEntry.count,
        queueTypeToMiniString(input->queue()),
        input->toString().utf8().data());

    m_queues[input->queue()].append(newEntry);
}

String ReplayInputLog::errorMessage() const
{
    ASSERT(hasError());
    StringBuilder sb;
    
    switch (m_errorData.error) {
    case ErrorExhaustedQueue:
        ASSERT(m_errorData.queue < ReplayInputQueueTypeLength);
        sb.append("Ran out of inputs on queue: ");
        sb.append(queueTypeToString(m_errorData.queue));
        sb.append(" because too many were requested.");
        break;

    case ErrorUnexpectedInputType: {
        ReplayInputQueueType queue = m_errorData.queue;
        ASSERT(queue < ReplayInputQueueTypeLength);
        sb.append("Expected next input to be a ");
        sb.append(m_errorData.expectedInput);
        sb.append(", but found a ");
      

        const InputEntry& entry = m_queues[queue].at(m_positions[queue]);
        NondeterministicInput* thisInput = entry.input;

        sb.append(thisInput->type());
        sb.append("(detail: ");
        sb.append(thisInput->toString());
        sb.append(")");
        break;
    }
    default:
        break;
    }
    
    return sb.toString();
}

void ReplayInputLog::reset()
{
    ASSERT(!m_isCapturing);

    LOG(TimelapseCapturing, "%-30s RESET\n", "[ReplayInputLog]");

    for (size_t i = 0; i < m_positions.size(); i++)
        m_positions[i] = 0;

    m_isReplaying = true;
    m_active = true;
    m_errorData.error = NoError;
    // TODO: deallocate anything stuck inside m_errorData
    m_isCapturing = false;
}

NondeterministicInput* ReplayInputLog::popExpectedInput(ReplayInputQueueType queue,
                                                    NondeterministicInput::ReplayInputType type)
{
    if (hasError()) {
        LOG_ERROR("%-30s prior memoized value retrieval failed, so not consulting log and instead propagating error condition.",
                  "ReplayInputLog::popExpectedInput");
        return 0;
    }
   
    NondeterministicInput* input = popInput(queue);

    if (input->type() != type) {
        LOG_ERROR("%-30s ERROR %p != %p\n", "[ReplayInputLog]", type, input->type());
        LOG_ERROR("%-25s Expected replay input of type %s, but got type %s (%s)\n",
                  "[ReplayInputLog]",
                  type, input->type(), input->toString().ascii().data());
        
        m_errorData.error = ErrorUnexpectedInputType;
        m_errorData.expectedInput = type;
        return 0;
    }

    return input;
}

NondeterministicInput* ReplayInputLog::popInput(ReplayInputQueueType queue)
{
    ASSERT(m_isReplaying);
    ASSERT(isActive());
    // callers should check for errors before requesting inputs.
    // if an error exists, the caller should call reset() or clearError()
    ASSERT(!hasError());
    ASSERT(queue < ReplayInputQueueTypeLength);
    
    if (m_positions[queue] >= m_queues[queue].size()) {
        LOG_ERROR("%-30s ERROR No more inputs remain for determinism queue %s, but one was requested.",
                  "[ReplayInputLog]",
                  queueTypeToString(queue));
        m_errorData.error = ErrorExhaustedQueue;
        m_errorData.queue = queue;
        return 0;
    }
    
    const InputEntry& entry = m_queues[queue].at(m_positions[queue]);

    LOG(TimelapseCapturing, "%-25s#%-5ld %s-YIELD: %s\n", "[ReplayInputLog]",
            entry.count, queueTypeToMiniString(queue),
            entry.input->toString().utf8().data());

    m_positions[queue] += 1;
    return entry.input;
}

void ReplayInputLog::setIsActive(bool state)
{
    ASSERT(m_active != state);
    m_active = state;
}
    
}; // namespace WTF
