
import {
    ArchitectureAnalysis,
    WorkspaceSnapshot
} from '../utilities/types';

import { callOllama } from './ollamaClient';
import { validateArchitecture } from './architectureAnalyzer';

export async function analyseComponents(
    project: WorkspaceSnapshot
): Promise<ArchitectureAnalysis> {

    const prompt = `
You are a senior software architect specializing in
UML component diagrams and software reverse engineering.

Analyze the ACTUAL project using the supplied file tree
and source code.

Identify major software components, their responsibilities,
technologies and actual dependencies.

Do not invent components, APIs, databases or services.
Only include components supported by project evidence.
Do not treat every source file as a separate component.

PROJECT FILE TREE:
${project.tree}

PROJECT SOURCE CODE:
${project.source}

Return ONLY valid JSON using this structure:

{
  "overview": "Overview of the actual component architecture",
  "layers": [
    {
      "name": "Application Layer",
      "components": [
        {
          "id": "user_interface",
          "name": "User Interface",
          "technology": "React",
          "description": "Handles user interactions and presentation"
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "user_interface",
      "to": "backend_api",
      "label": "HTTP requests"
    }
  ],
  "dataFlow": [
    "The user interacts with the interface",
    "The interface communicates with the backend"
  ]
}

STRICT RULES:

1. Identify actual software components, not individual files.
2. Group related components into logical architectural layers.
3. Include frontend, backend, APIs, business logic,
   authentication, databases and integrations where present.
4. Every component must have a unique lowercase ID.
5. IDs may contain only letters, numbers and underscores.
6. Connections must reference existing component IDs.
7. Include only relationships supported by source evidence.
8. Do not create artificial connections between layers.
9. Do not invent technologies. Use "Unknown" if necessary.
10. Keep component descriptions concise and factual.
11. Connection labels MUST contain 2-4 words maximum.
12. Connection labels should describe the relationship,
    not explain the entire data flow.
13. Prefer labels such as:
    "HTTP requests", "Database queries",
    "Vector retrieval", "Authentication",
    "Data persistence", "Event publishing".
14. Do not repeat the same directed connection.
15. Do not create reverse connections unless the source
    code establishes a separate reverse interaction.
16. Keep the architecture logically understandable.
17. Return JSON only, without Markdown fences.
`;

    const result = await callOllama(prompt, true);

    let parsed: ArchitectureAnalysis;

    try {
        const cleaned = result
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        parsed = JSON.parse(cleaned) as ArchitectureAnalysis;

    } catch {
        throw new Error(
            'Ollama returned invalid component analysis JSON.'
        );
    }

    return validateArchitecture(parsed);
}
