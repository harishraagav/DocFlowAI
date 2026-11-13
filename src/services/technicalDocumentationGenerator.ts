
import {
    WorkspaceSnapshot
} from '../utilities/types';

import { analyseProjectOverview } from './projectOverviewAnalyzer';
import { analyseTechnologyStack } from './technologyStackAnalyzer';
import { analyseApiDiscovery } from './apiDiscoveryAnalyzer';
import { callOllama } from './ollamaClient';

function cleanMarkdown(response: string): string {

    let markdown = response.trim();

    markdown = markdown
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    if (markdown.length < 200) {
        throw new Error(
            'Ollama returned incomplete technical documentation.'
        );
    }

    if (!/^#\s+/m.test(markdown)) {
        markdown = `# Technical Documentation\n\n${markdown}`;
    }

    return markdown;
}

export async function generateTechnicalDocumentation(
    project: WorkspaceSnapshot,
    projectName: string,
    onProgress?: (message: string) => void
): Promise<string> {

    if (!project.tree.trim()) {
        throw new Error('Cannot document an empty workspace.');
    }

    // Reuse the existing project intelligence analyzers.
    // Sequential execution avoids sending several large requests
    // to the local Ollama model simultaneously.

   
    onProgress?.('Analyzing project overview...');
    const overview = await analyseProjectOverview(project);

    onProgress?.('Detecting technologies...');
    const technologyStack = await analyseTechnologyStack(project);

    onProgress?.('Discovering and verifying APIs...');
    const apiDiscovery = await analyseApiDiscovery(project);

    onProgress?.('Generating developer documentation with Ollama...');

    const evidence = {
        projectOverview: overview,
        technologyStack,
        apiDiscovery
    };

    const sourceLimit = 45000;

    const source = project.source.slice(0, sourceLimit);

    const truncated = project.source.length > sourceLimit;

    const prompt = `
You are a senior software architect and technical documentation engineer.

Generate comprehensive, developer-oriented technical documentation
for the supplied software project.

PROJECT NAME:
${projectName}

PROJECT FILE TREE:
${project.tree}

ANALYZER RESULTS:
${JSON.stringify(evidence, null, 2)}

SOURCE CODE:
${source}

${truncated
    ? 'WARNING: SOURCE CODE WAS TRUNCATED. Do not claim that all files were analyzed.'
    : 'SOURCE CODE WAS NOT TRUNCATED.'}

DOCUMENTATION REQUIREMENTS:

Create a technically accurate Markdown document with these sections:

1. Project Introduction

- Purpose
- Main capabilities
- Project type

2. System Architecture

- High-level architecture
- Major modules and their responsibilities
- Relationships between modules
- Clearly distinguish verified facts from uncertain details

3. Technology Stack

- Languages
- Frameworks
- Libraries
- Databases and storage
- Tools and external services
- Explain the purpose of each identified technology

4. Project Structure

- Important directories and files
- Responsibility of important source files
- Entry points

5. Application Execution Flow

- Explain the application's execution sequence
- Describe how major modules interact
- Use numbered steps where useful

6. Data Flow and Processing

- Explain how input enters the application
- Explain important processing stages
- Explain output generation and storage
- Do not invent data flows that are not supported by evidence

7. API and External Communication

- Include verified server routes and outgoing HTTP requests
- Distinguish server APIs from client requests
- If none were verified, explicitly say so
- Do not invent endpoints

8. Data Storage

- Identify confirmed databases, files and storage mechanisms
- Explain what information they store
- Do not assume a database exists

9. Configuration and Environment

- Document only configuration values and environment variables
  that are visible in the supplied project evidence
- Mark unknown configuration as not identified

10. Setup and Execution

- Include commands only when supported by manifests,
  README instructions or source evidence
- Do not invent installation commands or prerequisites

11. Limitations and Technical Observations

- Include evidence-backed observations
- Identify missing information honestly

12. Documentation Scope

- Explain that this document is generated from a static workspace scan
- Mention that dynamic behavior may not be fully represented

STRICT ACCURACY RULES:

- Use only the supplied project tree, source code and analyzer results.
- Never invent frameworks, files, functions, APIs, ports or configuration.
- Do not treat a normal function as an HTTP endpoint.
- Do not assume authentication, deployment or hosting details.
- Do not claim a command works unless supported by project evidence.
- Do not invent database tables or schemas.
- Do not silently fill gaps with general programming knowledge.
- If a detail cannot be established, write "Not identified in the scanned source."
- Avoid repeating the same information in multiple sections.
- Keep explanations clear, structured and useful to a developer.
- Do not include fictional code examples.
- Preserve actual file names and technology names.
- Do not claim that all files were analyzed if the source was truncated.

OUTPUT:

Return the complete technical documentation in Markdown.
Do not wrap the entire response in a Markdown code fence.
Begin with a single H1 title.
`;

    const response = await callOllama(prompt, false);

    return cleanMarkdown(response);
}
