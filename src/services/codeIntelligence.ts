import { callOllama } from './ollamaClient';

const MAX_CODE_LENGTH = 30000;

function cleanMarkdown(value: string, title: string): string {
    let markdown = value
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    if (!markdown) {
        throw new Error(`Ollama returned an empty ${title.toLowerCase()}.`);
    }

    if (!/^#\s+/m.test(markdown)) {
        markdown = `# ${title}\n\n${markdown}`;
    }

    return `${markdown}\n`;
}

export async function explainCode(
    projectName: string,
    filePath: string,
    languageId: string,
    code: string,
    fullFileContext?: string
): Promise<string> {
    if (!code.trim()) {
        throw new Error('There is no code to explain. Select code or open a source file.');
    }

    const truncated = code.length > MAX_CODE_LENGTH;
    const source = code.slice(0, MAX_CODE_LENGTH);
    const context = (fullFileContext ?? '').slice(0, 12000);

    const prompt = `
You are a careful senior software engineer explaining existing source code.

PROJECT: ${projectName}
FILE: ${filePath}
LANGUAGE: ${languageId}
FOCUSED SOURCE (may be a selection):
${source}

SURROUNDING FILE CONTEXT (supporting context only):
${context || 'Not supplied.'}

SOURCE TRUNCATED: ${truncated}

Write a practical Markdown explanation with these sections:
1. Purpose and high-level summary
2. Step-by-step execution / logic
3. Important functions, classes, variables and expressions
4. Inputs, outputs, side effects and dependencies visible in the code
5. Assumptions and limitations that cannot be verified from this snippet

Rules:
- Explain only behavior supported by the supplied source.
- Do not invent functions, endpoints, files, dependencies or runtime results.
- Clearly distinguish a direct observation from an inference.
- Do not claim that imported code behaves a certain way unless its implementation is included.
- Use short code references where useful.
- If the focused source is a selection, explain that selection rather than pretending it is the entire file.
- If source is truncated, disclose that limitation.
- Return Markdown only.
`;

    return cleanMarkdown(await callOllama(prompt, false), 'Code Explanation');
}

export async function suggestCodeImprovements(
    projectName: string,
    filePath: string,
    languageId: string,
    code: string
): Promise<string> {
    if (!code.trim()) {
        throw new Error('There is no code to review. Select code or open a source file.');
    }

    const truncated = code.length > MAX_CODE_LENGTH;
    const source = code.slice(0, MAX_CODE_LENGTH);

    const prompt = `
You are a senior engineer performing a conservative source-level code review.

PROJECT: ${projectName}
FILE: ${filePath}
LANGUAGE: ${languageId}
SOURCE:
${source}

SOURCE TRUNCATED: ${truncated}

Return a Markdown report with:
1. Summary
2. Findings (each with priority, exact line or expression evidence, why it matters, and a practical change)
3. Optional improvements (clearly separated from defects)
4. Scope and limitations

STRICT RULES:
- Never claim a defect, vulnerability, performance issue or runtime failure without concrete source evidence.
- Do not recommend safeguards already present in the source.
- Prefer small, targeted changes; do not introduce libraries without a demonstrated need.
- Do not invent lines, APIs, environment variables, dependencies or project behavior.
- Treat missing validation/error handling as a possible improvement, not proof of failure or vulnerability.
- If no meaningful source-specific findings exist, say so instead of filling the report with generic advice.
- Mention that this is a static review and does not execute tests.
- Return Markdown only.
`;

    return cleanMarkdown(await callOllama(prompt, false), 'Code Improvement Suggestions');
}

export async function documentFunction(
    projectName: string,
    filePath: string,
    languageId: string,
    functionName: string,
    startLine: number,
    functionSource: string
): Promise<string> {
    if (!functionSource.trim()) {
        throw new Error('The selected function has no source content.');
    }

    const prompt = `
You are a technical writer documenting one existing function or method.

PROJECT: ${projectName}
FILE: ${filePath}
LANGUAGE: ${languageId}
FUNCTION: ${functionName}
START LINE: ${startLine}
SOURCE:
${functionSource.slice(0, MAX_CODE_LENGTH)}

Produce a Markdown function reference with:
- Purpose
- Signature
- Parameters (only those visible in the signature)
- Return behavior (only when supported by the body)
- Step-by-step logic
- Dependencies and side effects visible in the function
- Error handling visible in the function
- Usage notes and limitations

Rules:
- Do not invent parameter types, defaults, return types or exceptions.
- Do not infer behavior from an imported function's name alone.
- Distinguish explicit behavior from inferred intent.
- If a parameter's role cannot be established, say so.
- Do not claim a function is asynchronous unless its declaration or returned operation shows this.
- Return Markdown only and begin with an H1 title.
`;

    return cleanMarkdown(await callOllama(prompt, false), `Function: ${functionName}`);
}
