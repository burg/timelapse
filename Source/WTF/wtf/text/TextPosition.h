/*
 * Copyright (C) 2010, Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef TextPosition_h
#define TextPosition_h

#include <wtf/Assertions.h>
#include <wtf/HashFunctions.h>
#include <wtf/HashTraits.h>

namespace WTF {

// An abstract number of element in a sequence. The sequence has a first element.
// This type should be used instead of integer because 2 contradicting traditions can
// call a first element '0' or '1' which makes integer type ambiguous.
class OrdinalNumber {
public:
    static OrdinalNumber fromZeroBasedInt(int zeroBasedInt) { return OrdinalNumber(zeroBasedInt); }
    static OrdinalNumber fromOneBasedInt(int oneBasedInt) { return OrdinalNumber(oneBasedInt - 1); }
    OrdinalNumber() : m_zeroBasedValue(0) { }

    int zeroBasedInt() const { return m_zeroBasedValue; }
    int oneBasedInt() const { return m_zeroBasedValue + 1; }

    bool operator==(OrdinalNumber other) const { return m_zeroBasedValue == other.m_zeroBasedValue; }
    bool operator!=(OrdinalNumber other) const { return !((*this) == other); }

    static OrdinalNumber first() { return OrdinalNumber(0); }
    static OrdinalNumber beforeFirst() { return OrdinalNumber(-1); }

private:
    OrdinalNumber(int zeroBasedInt) : m_zeroBasedValue(zeroBasedInt) { }
    int m_zeroBasedValue;
};

template<> struct IntHash<OrdinalNumber> {
    static unsigned hash(const OrdinalNumber& number) { return IntHash<int>::hash(number.zeroBasedInt()); }
    static bool equal(const OrdinalNumber& a, const OrdinalNumber& b) { return a == b; }
    static const bool safeToCompareToEmptyOrDeleted = true;
};
template<> struct DefaultHash<OrdinalNumber> { typedef IntHash<OrdinalNumber> Hash; };

template<> struct HashTraits<OrdinalNumber> : GenericHashTraits<OrdinalNumber> {
    static const bool emptyValueIsZero = true;
    static const bool needsDestruction = false;
    static void constructDeletedValue(OrdinalNumber& number) { number = OrdinalNumber::beforeFirst(); }
    static bool isDeletedValue(const OrdinalNumber& number) { return number == OrdinalNumber::beforeFirst(); }
};

// TextPosition structure specifies coordinates within an text resource. It is used mostly
// for saving script source position.
class TextPosition {
public:
    TextPosition(OrdinalNumber line, OrdinalNumber column)
        : m_line(line)
        , m_column(column)
    {
    }
    TextPosition() { }
    bool operator==(const TextPosition& other) const { return m_line == other.m_line && m_column == other.m_column; }
    bool operator!=(const TextPosition& other) const { return !((*this) == other); }

    // A 'minimum' value of position, used as a default value.
    static TextPosition minimumPosition() { return TextPosition(OrdinalNumber::first(), OrdinalNumber::first()); }

    // A value with line value less than a minimum; used as an impossible position.
    static TextPosition belowRangePosition() { return TextPosition(OrdinalNumber::beforeFirst(), OrdinalNumber::beforeFirst()); }

    OrdinalNumber m_line;
    OrdinalNumber m_column;
};


template<> struct IntHash<TextPosition> {
    static unsigned hash(const TextPosition& position) { return pairIntHash(position.m_line.zeroBasedInt(), position.m_column.zeroBasedInt()); }
    static bool equal(const TextPosition& a, const TextPosition& b) { return a == b; }
    static const bool safeToCompareToEmptyOrDeleted = true;
};
template<> struct DefaultHash<TextPosition> { typedef IntHash<TextPosition> Hash; };

template<> struct HashTraits<TextPosition> : GenericHashTraits<TextPosition> {
    static const bool emptyValueIsZero = true;
    static const bool needsDestruction = false;
    static void constructDeletedValue(TextPosition& position) { position = TextPosition::belowRangePosition(); }
    static bool isDeletedValue(const TextPosition& position) { return position == TextPosition::belowRangePosition(); }
};

}

using WTF::OrdinalNumber;

using WTF::TextPosition;

#endif // TextPosition_h
