/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
 *  Copyright (C) 2005 Apple Computer, Inc.
 *
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 *
 */

#include "config.h"

#if ENABLE(WEB_REPLAY)

#include "ReplayInputTypes.h"

namespace WebCore {

#define INITIALIZE_INPUT_TYPE(name) \
    , name(#name, AtomicString::ConstructFromLiteral)

ReplayInputTypes::ReplayInputTypes()
    : dummy(0)
REPLAY_INPUT_TYPES_FOR_EACH(INITIALIZE_INPUT_TYPE)
{
}

} // namespace WebCore

#endif // ENABLE(WEB_REPLAY)
