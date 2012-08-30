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

#if ENABLE(TIMELAPSE)

#include "CacheController.h"

#include "Logging.h"
#include "MemoryCache.h"

namespace WebCore {

CacheController::~CacheController() {}

void CacheController::enableCache()
{
    if (!m_haveSavedSettings)
        return;

    m_haveSavedSettings = false;
    [NSURLCache setSharedURLCache:m_savedCache.get()];
    LOG(Timelapse, "%-30s Restored the NSURLCache.\n", "[CacheController]");
    m_savedCache.clear();
    memoryCache()->setDisabled(false);
    LOG(Timelapse, "%-30s Enabled the MemoryCache.\n", "[CacheController]");
}

void CacheController::disableCache(bool saveSettings)
{
    if (saveSettings) {
        m_savedCache = [NSURLCache sharedURLCache];
	m_haveSavedSettings = true;
    }

    if (!m_dummyCache) {
        LOG(Timelapse, "%-30s Creating a dummy cache for use when capturing and replaying.\n", "[CacheController]");
        NSString* cacheName = [NSString stringWithFormat: @"%@-%@",
                               @"TimelapseCache",
                               [[NSProcessInfo processInfo] globallyUniqueString]];
        NSString* diskPath = [NSTemporaryDirectory() stringByAppendingPathComponent: cacheName];

        m_dummyCache = [[NSURLCache alloc] initWithMemoryCapacity: 0
                                                     diskCapacity: 0
                                                         diskPath: diskPath];
        [diskPath release];
    }

    [NSURLCache setSharedURLCache:m_dummyCache.get()];
    LOG(Timelapse, "%-30s Disabled the NSURLCache.\n", "[CacheController]");
    memoryCache()->setDisabled(true);
    LOG(Timelapse, "%-30s Disabled the MemoryCache.\n", "[CacheController]");
}

bool CacheController::cacheState() const
{
    NSURLCache* currentCache = [NSURLCache sharedURLCache];
    bool usingDummyCache = currentCache == m_dummyCache;
    bool cacheIsNonzeroSize = [currentCache memoryCapacity] || [currentCache diskCapacity];
    bool state = usingDummyCache || !cacheIsNonzeroSize;
    [currentCache release];
    return state;
}
    
} // namespace WebCore

#endif // ENABLE(TIMELAPSE)
