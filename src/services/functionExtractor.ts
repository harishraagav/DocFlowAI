export interface FunctionCandidate {
    name: string;
    line: number;
    endLine: number;
    source: string;
}

function findPythonFunctions(lines: string[]): FunctionCandidate[] {
    const results: FunctionCandidate[] = [];

    for (let index = 0; index < lines.length; index++) {
        const match = lines[index].match(
            /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/
        );
        if (!match) continue;

        const baseIndent = match[1].length;
        let end = index + 1;

        while (end < lines.length) {
            const current = lines[end];
            if (current.trim()) {
                const indent = current.match(/^\s*/)?.[0].length ?? 0;
                if (indent <= baseIndent) break;
            }
            end++;
        }

        const body = lines.slice(index, end).join('\n').trimEnd();
        results.push({
            name: match[2],
            line: index + 1,
            endLine: index + body.split('\n').length,
            source: body
        });
    }

    return results;
}

function findBraceFunctions(lines: string[]): FunctionCandidate[] {
    const results: FunctionCandidate[] = [];
    const declarationPatterns = [
        /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
        /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/,
        /^\s*(?:(?:public|private|protected|static|async|override|virtual|abstract)\s+)*([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?::\s*[^={]+)?\s*\{/
    ];

    for (let index = 0; index < lines.length; index++) {
        let name: string | undefined;
        for (const pattern of declarationPatterns) {
            const match = lines[index].match(pattern);
            if (match?.[1]) {
                name = match[1];
                break;
            }
        }
        if (!name || ['if', 'for', 'while', 'switch', 'catch', 'with'].includes(name)) {
            continue;
        }

        let braceDepth = 0;
        let sawBrace = false;
        let end = index;
        for (; end < lines.length; end++) {
            // This is intentionally a lightweight brace counter, not a parser.
            const line = lines[end].replace(/(['"`])(?:\\.|(?!\1)[^\\])*?\1/g, '');
            for (const character of line) {
                if (character === '{') {
                    braceDepth++;
                    sawBrace = true;
                } else if (character === '}') {
                    braceDepth--;
                }
            }
            if (sawBrace && braceDepth <= 0) break;
            if (!sawBrace && end > index) break;
        }

        const last = Math.min(end, lines.length - 1);
        const body = lines.slice(index, last + 1).join('\n').trimEnd();
        results.push({
            name,
            line: index + 1,
            endLine: index + body.split('\n').length,
            source: body
        });
        index = last;
    }

    return results;
}

export function extractFunctionCandidates(
    source: string,
    languageId: string
): FunctionCandidate[] {
    const lines = source.split(/\r?\n/);
    const language = languageId.toLowerCase();

    if (language === 'python' || language === 'py') {
        return findPythonFunctions(lines);
    }

    return findBraceFunctions(lines);
}
