
import { WorkspaceSnapshot } from '../utilities/types';
import { callOllama } from './ollamaClient';

export async function generateReadme(
    snapshot: WorkspaceSnapshot,
    projectName: string
): Promise<string> {
    if (!snapshot.source.trim()) {
        throw new Error(
            'No project source was available to generate a README.'
        );
    }

    const prompt = `
You are a senior technical writer and software engineer.

Generate a complete, professional README.md for the supplied software project.

PROJECT NAME:
${projectName}

PROJECT FILE TREE:
${snapshot.tree}

PROJECT SOURCE:
${snapshot.source.slice(0, 65000)}

REQUIREMENTS:

1. Return Markdown only. Do not wrap the entire response in code fences.
2. Start with the project name as an H1 heading.
3. Include:
   - Project overview
   - Key features
   - Technology stack
   - Project structure
   - Installation and setup
   - Configuration
   - How to run the project
   - Usage examples
   - Important implementation details
   - Limitations or known constraints
   - Contributing
   - License
4. Explain the actual project, not a generic imagined application.
5. Use only technologies supported by the supplied files.
6. Derive installation commands from actual manifests and scripts.
7. Do not invent environment variables, API keys, ports, commands,
   features, test suites, deployment steps or configuration options.
8. If a detail cannot be verified, explicitly write
   "Not specified in the supplied project files."
9. Do not claim tests pass unless test results are present.
10. Do not invent a license. If none is found, state that
    the license has not been specified.
11. Make instructions beginner-friendly and practical.
12. Use code blocks for commands and examples.
13. Avoid repeating the same information in multiple sections.

Return the complete README Markdown now.
`;

    const response = await callOllama(prompt, false);

    let markdown = response.trim();

    // Remove a surrounding Markdown fence if the model adds one.
    const fenced = markdown.match(
        /^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i
    );

    if (fenced) {
        markdown = fenced[1].trim();
    }

    if (
        markdown.length < 100 ||
        !/^#\s+.+/m.test(markdown)
    ) {
        throw new Error(
            'Ollama returned an incomplete README. Please try again.'
        );
    }

    return markdown + '\n';
}
