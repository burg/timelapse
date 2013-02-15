# Source notes for WebKit's JavaScriptCore #

<div id="generated-toc"></div>

## Parsing ##

### Line Number Information ###

Each method body gets byte-compiled into a `CodeBlock` object. If
debugging or profiling is enabled, then some extra line number
information is also stored in the code block. This allows breakpoints,
exceptions, etc to be traced back to the source location.

There are two different mappings: one is from instruction (bytecode)
offsets to source line, and the other is from bytecode offset to a
source range. A single data point for each of these is stored in the
respective struct below:

<pre class="brush: cpp">
    struct ExpressionRangeInfo {
        enum {
            MaxOffset = (1 << 7) - 1, 
            MaxDivot = (1 << 25) - 1
        };
        uint32_t instructionOffset : 25;
        uint32_t divotPoint : 25;
        uint32_t startOffset : 7;
        uint32_t endOffset : 7;
    };

    struct LineInfo {
        uint32_t instructionOffset;
        int32_t lineNumber;
    };
</pre>

Note that `ExpressionRangeInfo` stores a source range as a
`divotPoint` (character index into the source string), plus or minus
some number of characters. So, the entire expression is the substring
of the source from index `(divotPoint - startOffset)` to index
`(divotPoint + endOffset)`.

These are then used by helper methods
`CodeBlock::expressionRangeForBytecodeOffset` and
`CodeBlock::lineNumberForBytecodeOffset`, and by higher-level methods
such as `Interpreter::appendSourceToError`. The source for the two
helper functions is below. Note that the Vector of line information is
sorted by (possibly sparse) instruction offset, and both methods do a
binary search over that vector to find the closest instruction offset.

<pre class="brush: cpp">
int CodeBlock::lineNumberForBytecodeOffset(unsigned bytecodeOffset)
{
    ASSERT(bytecodeOffset &lt; m_instructionCount);

    if (!m_rareData)
        return m_ownerExecutable-&gt;source().firstLine();

    Vector&lt;LineInfo&gt;& lineInfo = m_rareData-&gt;m_lineInfo;

    int low = 0;
    int high = lineInfo.size();
    while (low &lt; high) {
        int mid = low + (high - low) / 2;
        if (lineInfo[mid].instructionOffset &lt;= bytecodeOffset)
            low = mid + 1;
        else
            high = mid;
    }

    if (!low)
        return m_ownerExecutable-&gt;source().firstLine();
    return lineInfo[low - 1].lineNumber;
}

void CodeBlock::expressionRangeForBytecodeOffset(unsigned bytecodeOffset, int& divot, int& startOffset, int& endOffset)
{
    ASSERT(bytecodeOffset &lt; m_instructionCount);

    if (!m_rareData) {
        startOffset = 0;
        endOffset = 0;
        divot = 0;
        return;
    }

    Vector&lt;ExpressionRangeInfo&gt;& expressionInfo = m_rareData-&gt;m_expressionInfo;

    int low = 0;
    int high = expressionInfo.size();
    while (low &lt; high) {
        int mid = low + (high - low) / 2;
        if (expressionInfo[mid].instructionOffset &lt;= bytecodeOffset)
            low = mid + 1;
        else
            high = mid;
    }

    ASSERT(low);
    if (!low) {
        startOffset = 0;
        endOffset = 0;
        divot = 0;
        return;
    }

    startOffset = expressionInfo[low - 1].startOffset;
    endOffset = expressionInfo[low - 1].endOffset;
    divot = expressionInfo[low - 1].divotPoint + m_sourceOffset;
    return;
}
</pre>
