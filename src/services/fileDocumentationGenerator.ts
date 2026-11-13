
import { callOllama } from './ollamaClient';

const MAX_SOURCE_LENGTH = 40000;

interface SourceFact {
    line: number;
    text: string;
}

interface SourceDeclaration extends SourceFact {
    name: string;
    kind: 'function' | 'class';
}

interface SourceAssignment extends SourceFact {
    name: string;
    expression: string;
}

interface SourceInvocation extends SourceFact {
    target: string;
    expression: string;
}

function extractFacts(
    source: string,
    pattern: RegExp
): SourceFact[] {
    const facts: SourceFact[] = [];
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
        pattern.lastIndex = 0;

        if (pattern.test(line)) {
            facts.push({
                line: index + 1,
                text: line.trim()
            });
        }
    });

    return facts;
}

/**
 * Extracts actual function and class declarations.
 * Calls to imported objects are deliberately excluded.
 */
function extractPythonDeclarations(
    source: string
): SourceDeclaration[] {
    const declarations: SourceDeclaration[] = [];
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
        const functionMatch = line.match(
            /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/
        );

        if (functionMatch) {
            declarations.push({
                line: index + 1,
                text: line.trim(),
                name: functionMatch[1],
                kind: 'function'
            });

            return;
        }

        const classMatch = line.match(
            /^\s*class\s+([A-Za-z_]\w*)\b/
        );

        if (classMatch) {
            declarations.push({
                line: index + 1,
                text: line.trim(),
                name: classMatch[1],
                kind: 'class'
            });
        }
    });

    return declarations;
}

/**
 * Extracts simple, single-line Python assignments.
 * The expression is preserved to help identify
 * the actual role of each assigned variable.
 */
function extractPythonAssignments(
    source: string
): SourceAssignment[] {
    const assignments: SourceAssignment[] = [];
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
        const match = line.match(
            /^\s*([A-Za-z_]\w*)\s*=(?!=)\s*(.*)$/
        );

        if (!match) {
            return;
        }

        assignments.push({
            line: index + 1,
            text: line.trim(),
            name: match[1],
            expression: match[2].trim()
        });
    });

    return assignments;
}

/**
 * Extracts call expressions separately from declarations.
 *
 * Examples:
 * retriever.invoke(question)
 * format_reviews(raw_reviews)
 * chain.invoke({...})
 *
 * These are invocations, not declarations.
 */

/**
 * Removes comments and string literals before detecting calls.
 * This prevents text such as "Ask your question (...)" from
 * being mistaken for an actual function invocation.
 */
function removePythonStringsAndComments(line: string): string {
    let result = '';
    let quote: string | null = null;
    let tripleQuoted = false;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (!quote && char === '#') {
            break;
        }

        if (!quote && (char === '"' || char === "'")) {
            const triple = line.slice(i, i + 3) === char.repeat(3);
            quote = char;
            tripleQuoted = triple;

            result += triple ? '   ' : ' ';
            if (triple) {
                i += 2;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                result += ' ';
                continue;
            }

            if (char === '\\') {
                escaped = true;
                result += ' ';
                continue;
            }

            if (tripleQuoted && line.slice(i, i + 3) === quote.repeat(3)) {
                quote = null;
                tripleQuoted = false;
                result += '   ';
                i += 2;
                continue;
            }

            if (!tripleQuoted && char === quote) {
                quote = null;
            }

            result += ' ';
            continue;
        }

        result += char;
    }

    return result;
}

function extractPythonInvocations(
    source: string
): SourceInvocation[] {
    const invocations: SourceInvocation[] = [];
    const lines = source.split(/\r?\n/);

    const callPattern =
        /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/g;

    lines.forEach((line, index) => {
        if (/^\s*(?:async\s+)?def\s+/.test(line)) {
            return;
        }

        const searchableLine =
            removePythonStringsAndComments(line);

        callPattern.lastIndex = 0;

        let match: RegExpExecArray | null;

        while ((match = callPattern.exec(searchableLine)) !== null) {
            invocations.push({
                line: index + 1,
                target: match[1],
                expression: line.trim(),
                text: `${match[1]}(...)`
            });
        }
    });

    return invocations;
}

/**
 * Extracts imported names and their aliases from simple Python imports.
 * Supports:
 *   from package import Name
 *   from package import Name as Alias
 *   import package
 *   import package as Alias
 */
function extractPythonImportedNames(source: string): Set<string> {
    const importedNames = new Set<string>();

    for (const line of source.split(/\r?\n/)) {
        const fromImport = line.match(
            /^\s*from\s+[\w.]+\s+import\s+(.+)$/
        );

        if (fromImport) {
            const importedPart = fromImport[1].split('#')[0];

            for (const item of importedPart.split(',')) {
                const match = item.trim().match(
                    /^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/
                );

                if (match) {
                    importedNames.add(match[2] || match[1]);
                }
            }

            continue;
        }

        const regularImport = line.match(
            /^\s*import\s+([\w., ]+)$/
        );

        if (regularImport) {
            for (const item of regularImport[1].split(',')) {
                const match = item.trim().match(
                    /^([\w.]+)(?:\s+as\s+([A-Za-z_]\w*))?$/
                );

                if (match) {
                    importedNames.add(
                        match[2] || match[1].split('.')[0]
                    );
                }
            }
        }
    }

    return importedNames;
}

/**
 * Gives each detected invocation a conservative source-based category.
 */
function classifyPythonInvocation(
    target: string,
    declarations: SourceDeclaration[],
    importedNames: Set<string>
): string {
    const rootName = target.split('.')[0];

    if (
        declarations.some(
            item => item.kind === 'function' && item.name === target
        )
    ) {
        return 'Call to locally defined function';
    }

    if (importedNames.has(rootName)) {
        if (target === rootName) {
            return /^[A-Z]/.test(rootName)
                ? 'Imported class constructor'
                : 'Imported callable or object invocation';
        }

        return /^[A-Z]/.test(rootName)
            ? 'Method call on an imported class'
            : 'Method call on an imported object';
    }

    const builtins = new Set([
        'print',
        'input',
        'len',
        'range',
        'str',
        'int',
        'float',
        'list',
        'dict',
        'set',
        'tuple',
        'sum',
        'min',
        'max',
        'open',
        'enumerate',
        'zip',
        'sorted',
        'isinstance',
        'type'
    ]);

    if (builtins.has(target)) {
        return 'Python built-in function';
    }

    if (target === 'join') {
        return 'String join method';
    }


    if (target.includes('.')) {
        return 'Object or module method invocation';
    }

    return 'Invocation; target origin not established';
}


function extractPythonStructure(source: string) {
    const declarations = extractPythonDeclarations(source);
    const assignments = extractPythonAssignments(source);
    const invocations = extractPythonInvocations(source);

    const imports = extractFacts(
        source,
        /^\s*(?:from\s+[\w.]+\s+import\s+.+|import\s+.+)$/
    );

    return {
        declarations,
        imports,
        assignments,
        invocations,

        // Explicitly separated inventories.
        definedFunctions: declarations.filter(
            item => item.kind === 'function'
        ),

        definedClasses: declarations.filter(
            item => item.kind === 'class'
        ),

        importedObjects: imports,

        assignedObjects: assignments,

        functionCalls: invocations,

        // Additional source evidence.
        controlFlow: extractFacts(
            source,
            /^\s*(?:if|elif|else|for|while|try|except|finally|with|return|break|continue)\b/
        ),

        exceptionHandling: extractFacts(
            source,
            /^\s*(?:try|except|finally)\b/
        ),

        pipelineExpressions: extractFacts(
            source,
            /^\s*.*(?:\||>>|\.pipe\s*\().*$/
        ),

        inputOutputOperations: extractFacts(
            source,
            /\b(?:input|print)\s*\(/
        ),

        fileOperations: extractFacts(
            source,
            /\b(?:open|read|read_text|read_bytes|write|write_text|write_bytes|mkdir|unlink|remove|rename)\s*\(/
        ),

        dataOperations: extractFacts(
            source,
            /\.(?:append|extend|insert|update|add|add_documents|join|split|iterrows|as_retriever)\s*\(/
        ),

        libraryInvocations: extractFacts(
            source,
            /\.(?:invoke|ainvoke|run|predict|generate|stream)\s*\(/
        ),

        returnStatements: extractFacts(
            source,
            /^\s*return\b/
        )
    };
}

/**
 * Generic structural extraction for other languages.
 * This is intentionally conservative and is not a full parser.
 */
function extractGenericStructure(source: string) {
    const declarations: SourceDeclaration[] = [];
    const assignments: SourceAssignment[] = [];
    const invocations: SourceInvocation[] = [];

    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
        const functionMatch = line.match(
            /^\s*(?:(?:export|public|private|protected)\s+)*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/
        );

        const classMatch = line.match(
            /^\s*(?:(?:export|public|default)\s+)*class\s+([A-Za-z_$][\w$]*)/
        );

        if (functionMatch) {
            declarations.push({
                line: index + 1,
                text: line.trim(),
                name: functionMatch[1],
                kind: 'function'
            });
        } else if (classMatch) {
            declarations.push({
                line: index + 1,
                text: line.trim(),
                name: classMatch[1],
                kind: 'class'
            });
        }

        const assignmentMatch = line.match(
            /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/
        );

        if (assignmentMatch) {
            assignments.push({
                line: index + 1,
                text: line.trim(),
                name: assignmentMatch[1],
                expression: assignmentMatch[2].trim()
            });
        }

        const callPattern =
            /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g;

        if (!functionMatch) {
            callPattern.lastIndex = 0;

            let match: RegExpExecArray | null;

            while ((match = callPattern.exec(line)) !== null) {
                invocations.push({
                    line: index + 1,
                    target: match[1],
                    expression: line.trim(),
                    text: `${match[1]}(...)`
                });
            }
        }
    });

    const imports = extractFacts(
        source,
        /^\s*(?:import|from|require\s*\(|#include)\b/
    );

    return {
        declarations,
        imports,
        assignments,
        invocations,

        definedFunctions: declarations.filter(
            item => item.kind === 'function'
        ),

        definedClasses: declarations.filter(
            item => item.kind === 'class'
        ),

        importedObjects: imports,

        assignedObjects: assignments,

        functionCalls: invocations,

        controlFlow: extractFacts(
            source,
            /^\s*(?:if|else|for|while|switch|try|catch|finally|return|throw)\b/
        ),

        exceptionHandling: extractFacts(
            source,
            /^\s*(?:try|catch|finally)\b/
        ),

        pipelineExpressions: extractFacts(
            source,
            /^\s*.*(?:\||\.pipe\s*\().*$/
        ),

        inputOutputOperations: extractFacts(
            source,
            /\b(?:console\.(?:log|info|warn|error)|prompt|readline)\s*\(/
        ),

        fileOperations: extractFacts(
            source,
            /\b(?:readFile|writeFile|readFileSync|writeFileSync|createReadStream|createWriteStream)\s*\(/
        ),

        dataOperations: [],

        libraryInvocations: extractFacts(
            source,
            /\.(?:invoke|run|predict|generate|execute|query)\s*\(/
        ),

        returnStatements: extractFacts(
            source,
            /^\s*return\b/
        )
    };
}

function cleanMarkdown(response: string): string {
    return response
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}


function countSourceLines(source: string): number {
    if (!source) {
        return 0;
    }

    const lines = source.replace(/\r\n/g, '\n').split('\n');

    // A trailing newline does not represent an additional source line.
    if (lines[lines.length - 1] === '') {
        lines.pop();
    }

    return lines.length;
}

function inferExpressionKind(
    expression: string,
    source: string
): string {
    const value = expression.trim();

    if (/^input\s*\(/.test(value)) {
        return 'String returned by user input';
    }

    if (/\|\s*[A-Za-z_]\w*/.test(value)) {
        return 'Composed pipeline / runnable';
    }

    if (/\.join\s*\(/.test(value)) {
        return 'String';
    }

    if (
        /^(?:f|r|b|u)?["']/.test(value) ||
        /^["'`]/.test(value)
    ) {
        return 'String';
    }

    if (/^\[|^list\s*\(/.test(value)) {
        return 'List / collection';
    }

    if (/^\{|^dict\s*\(/.test(value)) {
        return 'Dictionary / mapping';
    }

    if (/^(?:True|False)$/.test(value)) {
        return 'Boolean';
    }

    if (/^-?\d+(?:\.\d+)?$/.test(value)) {
        return 'Numeric value';
    }

    if (/\.invoke\s*\(/.test(value)) {
        return 'Invocation result; runtime type not independently verified';
    }

    const functionCall = value.match(
        /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/
    );

    if (functionCall) {
        const calledName = functionCall[1];
        const rootName = calledName.split('.')[0];

        const importedNames = extractPythonImportedNames(source);

        // Method call on an imported class or object.
        // Example: ChatPromptTemplate.from_template(...)
        if (
            importedNames.has(rootName) &&
            calledName.includes('.')
        ) {
            return `Result of imported method \`${calledName}\`; runtime type not independently verified`;
        }

        // Imported class constructor.
        // Example: OllamaLLM(...)
        if (
            /^[A-Z]/.test(rootName) &&
            importedNames.has(rootName)
        ) {
            return `Instance created by imported class \`${rootName}\``;
        }

        // Check whether the called function is actually defined locally.
        const escapedName = rootName.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const localFunctionPattern = new RegExp(
            `^\\s*def\\s+${escapedName}\\s*\\(`,
            'm'
        );

        if (localFunctionPattern.test(source)) {
            return `Result of locally defined function \`${rootName}\`; runtime type not independently verified`;
        }

        // Do not assume an unidentified call is locally defined.
        return 'Call result; origin and runtime type not established';
    }

    if (/^None$/.test(value)) {
        return 'None';
    }

    return 'Unknown; runtime type not established by this expression';
}

function formatSourceFacts(
    facts: SourceFact[],
    emptyMessage: string
): string {
    if (!facts.length) {
        return emptyMessage;
    }

    return facts.map(fact =>
        `- Line ${fact.line}: \`${fact.text}\``
    ).join('\n');
}

function extractGeneratedSection(
    markdown: string,
    sectionNumber: number
): string {
    const escapedNumber = sectionNumber.toString();

    const pattern = new RegExp(
        `^##\\s+${escapedNumber}\\.\\s+[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+\\d+\\.|$(?![\\s\\S]))`,
        'm'
    );

    const match = markdown.match(pattern);

    return match?.[1]?.trim() || '';
}

function formatAssignments(
    assignments: SourceAssignment[],
    source: string
): string {
    if (!assignments.length) {
        return 'No simple assignments were identified.';
    }

    return assignments.map(item => {
        const inferredKind = inferExpressionKind(
            item.expression,
            source
        );

        return [
            `- **\`${item.name}\`** — ${inferredKind}`,
            `  - Line: ${item.line}`,
            `  - Expression: \`${item.expression}\``
        ].join('\n');
    }).join('\n');
}

function formatDeclarations(
    declarations: SourceDeclaration[]
): string {
    if (!declarations.length) {
        return 'No function or class declarations were identified.';
    }

    return declarations.map(item =>
        `- **${item.kind}: \`${item.name}\`** — line ${item.line}`
    ).join('\n');
}

function formatExecutionEvidence(
    structure: ReturnType<typeof extractPythonStructure> |
        ReturnType<typeof extractGenericStructure>
): string {
    const facts = [
        ...structure.declarations,
        ...structure.assignments,
        ...structure.controlFlow,
        ...structure.invocations
    ];

    const uniqueFacts = new Map<number, string>();

    for (const fact of facts) {
        uniqueFacts.set(fact.line, fact.text);
    }

    if (!uniqueFacts.size) {
        return 'No execution-related structural evidence was identified.';
    }

    return [...uniqueFacts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([line, text]) => `- Line ${line}: \`${text}\``)
        .join('\n');
}




export async function generateFileDocumentation(
    filePath: string,
    languageId: string,
    fileContent: string,
    projectName: string
): Promise<string> {

    const originalLength = fileContent.length;
    const wasTruncated = originalLength > MAX_SOURCE_LENGTH;

    const sourceContext = fileContent.slice(
        0,
        MAX_SOURCE_LENGTH
    );

    const isPython =
        languageId.toLowerCase() === 'python' ||
        filePath.toLowerCase().endsWith('.py');

    const structure = isPython
        ? extractPythonStructure(sourceContext)
        : extractGenericStructure(sourceContext);

    const sourceLineCount = countSourceLines(sourceContext);

    // AI-generated explanatory content only.
    const prompt = `
You are a senior software engineer.

Analyze the supplied source file and write ONLY these
three Markdown sections:

## 1. File Overview

Explain the actual purpose of this file using its source.

## 2. Responsibilities

List the main responsibilities supported by the source.

## 3. Potential Improvements

Give practical, source-specific recommendations.
Clearly distinguish recommendations from existing functionality.

PROJECT: ${projectName}

FILE: ${filePath}

LANGUAGE: ${languageId}

SOURCE:
${sourceContext}


IMPORTANT RULES:

- Do not invent functions, classes, variables or imports.
- Do not invent line counts or data types.
- Do not claim functionality that is not visible in the source.
- Do not invent installation commands, dependencies or APIs.
- Do not claim external library internals were verified.
- Every improvement recommendation must relate to an identifiable source statement, missing implementation safeguard, or concrete design limitation.
- When possible, reference the relevant source expression or line.
- Do not describe hypothetical problems as confirmed defects.
- Do not claim that user input is invalid merely because validation is absent.
- Do not recommend caching or performance optimization without evidence of a performance problem.
- Do not repeat generic recommendations such as "add comments" or "improve readability" unless the source provides a specific reason.
- If no meaningful source-specific improvements can be identified, say so.
- Clearly distinguish existing functionality from suggested changes.
- Do not add an introduction, conclusion or extra sections.
- Return only the three requested Markdown sections.
- Do not describe a local module, imported object, retriever, or library invocation as an external API unless the source explicitly demonstrates HTTP communication or an API endpoint.
- When a file imports an object from another local module, describe it as an imported dependency. Do not assume how that dependency is implemented.
- Before recommending that a missing value needs a fallback, inspect whether the source already uses defaults, optional access, or equivalent safeguards.
- Never recommend adding functionality that is already implemented.
- Do not claim that a function lacks error handling for a particular case unless the source provides evidence of that specific failure.
- Distinguish missing input validation from an established runtime defect.
- Prefer small, targeted improvements over introducing new libraries.
- Do not recommend replacing existing functionality with a library unless the source demonstrates a concrete need.
- Recommendations must identify the specific operation that could fail or benefit from additional validation.
- Distinguish missing error handling from a confirmed runtime failure.
- Do not recommend adding safeguards that are already present in the source.
`;

    const response = await callOllama(prompt, false);
    const generatedMarkdown = cleanMarkdown(response);

    if (!generatedMarkdown) {
        throw new Error(
            'Ollama returned empty file documentation.'
        );
    }

    const overview = extractGeneratedSection(
        generatedMarkdown,
        1
    );

    const responsibilities = extractGeneratedSection(
        generatedMarkdown,
        2
    );

    const improvements = extractGeneratedSection(
        generatedMarkdown,
        3
    );

    // 1. File Overview
    const overviewSection = overview ||
        `This file is part of the ${projectName} project. ` +
        'Its purpose should be determined from the source code.';

    // 2. Responsibilities
    const responsibilitySection = sanitizeUnverifiedApiClaims(
        responsibilities || 'No responsibilities were identified.',
        fileContent
    );
    // 3. Imports and Dependencies
    const importSection = formatSourceFacts(
        structure.imports,
        'No imports were identified.'
    );

    // 4. Functions, Classes and Objects
    const declarationSection = formatDeclarations(
        structure.declarations
    );

    const assignedObjectSection = formatAssignments(
        structure.assignments,
        sourceContext
    );

    
const importedNames = isPython
    ? extractPythonImportedNames(sourceContext)
    : new Set<string>();

    const invocationSection = structure.invocations.length
        ? structure.invocations.map(item => {
            const category = isPython
                ? classifyPythonInvocation(
                    item.target,
                    structure.declarations,
                    importedNames
                )
                : 'Function or method invocation';

            return [
                `- **\`${item.target}\`** — ${category}`,
                `  - Line: ${item.line}`
            ].join('\n');
        }).join('\n')
        : 'No function or method invocations were identified.';

    const sectionFour = `
### Locally Defined Functions and Classes

${declarationSection}

### Assigned Objects and Variables

${assignedObjectSection}

### Function and Method Invocations

${invocationSection}
`;

    // 5. Execution Flow
    const executionSection = formatExecutionEvidence(
        structure
    );

    const sectionFive = `
The following source statements are listed in their
actual source order. They provide structural evidence
of the execution flow; runtime behavior is not simulated.

${executionSection}
`;

    // 6. Inputs and Outputs
    
    const inputOutputSection = `
    ### User Input and Console Operations

    ${formatSourceFacts(
        structure.inputOutputOperations,
        'No recognized user-input or console-output operations were identified.'
    )}

    ### Framework and Object Invocations

    ${formatSourceFacts(
        structure.libraryInvocations,
        'No recognized library invocation methods were identified.'
    )}

    ### Function Return Statements

    ${formatSourceFacts(
        structure.returnStatements,
        'No explicit return statements were identified.'
    )}
    `;

    const stateSection = `
    ### Data Operations

    ${formatSourceFacts(
        structure.dataOperations,
        'No recognized data-operation calls were identified.'
    )}

    ### Data Transformations

    ${formatSourceFacts(
        structure.returnStatements,
        'No explicit return-based transformations were identified.'
    )}

    ### Pipeline Expressions

    ${formatSourceFacts(
        structure.pipelineExpressions,
        'No pipeline expressions were identified.'
    )}
    `;


    // 8. Error Handling
    const errorSection = structure.exceptionHandling.length
        ? formatSourceFacts(
            structure.exceptionHandling,
            ''
        )
        : 'No explicit exception-handling blocks were identified.';

    // 9. Side Effects
    const sideEffectSection = `
### User Input and Console Output

${formatSourceFacts(
    structure.inputOutputOperations,
    'No recognized input/output operations were identified.'
)}

### File Operations

${formatSourceFacts(
    structure.fileOperations,
    'No recognized file operations were identified.'
)}

### Data Operations

${formatSourceFacts(
    structure.dataOperations,
    'No recognized data-operation calls were identified.'
)}

### Framework and Object Invocations

${formatSourceFacts(
    structure.libraryInvocations,
    'No recognized library invocation methods were identified.'
)}
`;

    // 10. Important Implementation Details
    const implementationSection = `
### Pipeline Expressions

${formatSourceFacts(
    structure.pipelineExpressions,
    'No pipeline expressions were identified.'
)}

### Control Flow

${formatSourceFacts(
    structure.controlFlow,
    'No recognized control-flow statements were identified.'
)}

### Data Transformations

${formatSourceFacts(
    structure.dataOperations,
    'No recognized data transformations were identified.'
)}
`;

    // 11. Potential Improvements
    const improvementSection = sanitizePotentialImprovements(
        improvements || 'No potential improvements were identified.',
        fileContent
    );
    // 12. Documentation Scope
    const scopeSection = `
- **Project:** ${projectName}
- **File:** ${filePath}
- **Language:** ${languageId}
- **Analyzed source lines:** ${sourceLineCount}
- **Original source characters:** ${originalLength}
- **Analyzed source characters:** ${sourceContext.length}
- **Source truncated:** ${wasTruncated ? 'Yes' : 'No'}

This documentation is based on the source content supplied
to the generator. Structural inventories use lightweight
pattern-based extraction rather than a complete language AST.

External modules, library internals and runtime behavior
were not independently verified.
`;

    // Final document assembly
    const documentation = `
# File Documentation: ${filePath}

## 1. File Overview

${overviewSection}

## 2. Responsibilities

${responsibilitySection}

## 3. Imports and Dependencies

${importSection}

## 4. Functions, Classes and Objects

${sectionFour}

## 5. Execution Flow

${sectionFive}

## 6. Inputs and Outputs

${inputOutputSection}

## 7. State and Data Handling

${stateSection}

## 8. Error Handling

${errorSection}

## 9. Side Effects

${sideEffectSection}

## 10. Important Implementation Details

${implementationSection}

## 11. Potential Improvements

${improvementSection}

## 12. Documentation Scope

${scopeSection}

---

*Generated by DocFlowAI*
`;

    return documentation.trim();
}

function hasDirectHttpEvidence(source: string): boolean {
    return /\b(?:requests\.(?:get|post|put|patch|delete|request)|httpx\.(?:get|post|put|patch|delete|request)|urllib\.request|fetch\s*\(|axios(?:\.(?:get|post|put|patch|delete|request))?|http\.client|socket\.)\b|https?:\/\//i.test(
        source
    );
}


function sanitizeUnverifiedApiClaims(
    markdown: string,
    source: string
): string {
    if (hasDirectHttpEvidence(source)) {
        return markdown;
    }

    return markdown
        .split(/\r?\n/)
        .map(line => {
            if (
                /\bexternal\s+(?:HTTP\s+)?API\b|\bAPI\s+(?:call|request|endpoint)\b/i.test(
                    line
                )
            ) {
                const bulletPrefix =
                    line.match(/^(\s*(?:[-*]\s+|\d+[.)]\s+)?)/)?.[0] ?? '';

                return (
                    bulletPrefix +
                    'Uses an imported dependency; its internal communication mechanism is not established by this file.'
                );
            }

            return line;
        })
        .join('\n');
}


function sanitizePotentialImprovements(
    markdown: string,
    source: string
): string {
    const httpEvidence = hasDirectHttpEvidence(source);

    const hasRatingFallback =
        /\.(?:get|setdefault)\s*\(\s*["']rating["']\s*,/i.test(
            source
        );
    const hasQuitCondition =
        /\b(?:input\s*\([^)]*\)[\s\S]{0,250}?\.lower\s*\(\)\s*==\s*["']q["']|\.lower\s*\(\)\s*==\s*["']q["'])/i.test(
            source
        ) &&
        /\bbreak\b/.test(source);

    const hasExplicitSecuritySink =
        /\b(?:eval|exec|subprocess\.run|subprocess\.Popen|os\.system|pickle\.loads|yaml\.load)\s*\(/i.test(
            source
        );

    const lines = markdown.split(/\r?\n/);

    const filteredLines = lines.filter(line => {
        // Do not recommend adding a rating fallback when one already exists.
        if (
            hasRatingFallback &&
            /\brating\b/i.test(line) &&
            /\b(?:missing|absent|default|fallback|always present|does not handle|not handled)\b/i.test(
                line
            )
        ) {
            return false;
        }

        // Do not make claims about API failures without HTTP evidence.
        if (
            !httpEvidence &&
            /\b(?:API|HTTP|endpoint|network request)\b/i.test(line)
        ) {
            return false;
        }

        // Remove unsupported security claims when no recognizable
        // security-sensitive operation is present in the source.
        if (
            !hasExplicitSecuritySink &&
            /\bsecurity\s+(?:vulnerabilit(?:y|ies)|risk|risks|threat)\b/i.test(
                line
            )
        ) {
            return false;
        }

        // Do not recommend adding a quit mechanism when one already exists.
        if (
            hasQuitCondition &&
            /\b(?:quit|exit|terminate|stop the program|exit the program)\b/i.test(
                line
            )
        ) {
            return false;
        }

        return true;
    });

    const result = filteredLines.join('\n').trim();

    return result || 'No source-specific improvements could be established after checking the recommendations against the available source evidence.';
}