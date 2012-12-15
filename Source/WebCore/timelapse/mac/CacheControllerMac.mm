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
    LOG(Timelapse, "%-30s Reverted to using the shared NSURLCache.\n", "[CacheController]");
    // empty dummy cache so next use of it starts fresh.
    [m_dummyCache.get() removeAllCachedResponses];
    m_savedCache.clear();
}

void CacheController::disableCache(bool saveSettings)
{
    if (saveSettings) {
        m_savedCache = [NSURLCache sharedURLCache];
	m_haveSavedSettings = true;
    }

    if (!m_dummyCache) {
        LOG(Timelapse, "%-30s Creating an NSURLCache for use when capturing and replaying.\n", "[CacheController]");
        NSString* cacheName = [NSString stringWithFormat: @"%@-%@",
                               @"TimelapseCache",
                               [[NSProcessInfo processInfo] globallyUniqueString]];
        NSString* diskPath = [NSTemporaryDirectory() stringByAppendingPathComponent: cacheName];

        m_dummyCache = [[NSURLCache alloc] initWithMemoryCapacity: 32 * 1024 * 1024 // 32 MB
                                                     diskCapacity: 32 * 1024 * 1024 // 32 MB
                                                         diskPath: diskPath];
        [diskPath release];
    }
    // using a zero-size cache may cause unwanted double loads. See Timelapse Issue #101.
    ASSERT([m_dummyCache.get() memoryCapacity] > 0);
    ASSERT([m_dummyCache.get() diskCapacity] > 0);

    [NSURLCache setSharedURLCache:m_dummyCache.get()];
    LOG(Timelapse, "%-30s Now using a Timelapse-only NSURLCache.\n", "[CacheController]");
    // again, we can't completely disable the memory cache, because it causes double loads.
    memoryCache()->evictResources();
    LOG(Timelapse, "%-30s Evicted all contents of the MemoryCache.\n", "[CacheController]");
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
