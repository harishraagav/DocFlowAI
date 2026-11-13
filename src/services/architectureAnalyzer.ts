
import {
    ArchitectureAnalysis,
    WorkspaceSnapshot
} from '../utilities/types';

import { callOllama } from './ollamaClient';

export async function analyseFullArchitecture(
    project: WorkspaceSnapshot
): Promise<ArchitectureAnalysis> {
    const prompt = `
You are a senior enterprise software architect.

Reverse-engineer the ACTUAL architecture of this project.

Analyse the project file tree and source code.

Do not invent technologies, databases, APIs or services.
Do not assume that the project uses microservices.
Only include components supported by the supplied evidence.

PROJECT FILE TREE:
${project.tree}

PROJECT SOURCE CODE:
${project.source}

Return ONLY valid JSON in this structure:

{
  "overview": "Description of the actual system",
  "layers": [
    {
      "name": "Presentation Layer",
      "components": [
        {
          "id": "frontend",
          "name": "Frontend Application",
          "technology": "React",
          "description": "Actual responsibility"
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "frontend",
      "to": "backend",
      "label": "HTTP API requests"
    }
  ],
  "dataFlow": [
    "User interacts with the application"
  ]
}

Rules:
1. Identify actual architectural layers.
2. Include frontend, backend, APIs, business logic,
   authentication, databases and external services where present.
3. Every component must have a unique lowercase ID.
4. Connections must reference existing component IDs.
5. Include 2-6 logical layers where appropriate.
6. Prefer 2-8 meaningful components per layer.
7. Do not represent every individual source file as a component.
8. Unknown technologies must be marked Unknown.
9. Do not invent relationships.
10. Return JSON only. No Markdown fences.
`;

    const result = await callOllama(prompt, true);

    let parsed: ArchitectureAnalysis;

    try {
        parsed = JSON.parse(result) as ArchitectureAnalysis;
    } catch {
        throw new Error(
            'Ollama returned invalid architecture JSON. Please try again.'
        );
    }

    return validateArchitecture(parsed);
}

export function validateArchitecture(
    analysis: ArchitectureAnalysis
): ArchitectureAnalysis {
    if (
        !analysis ||
        typeof analysis.overview !== 'string' ||
        !Array.isArray(analysis.layers) ||
        !Array.isArray(analysis.connections)
    ) {
        throw new Error('Invalid architecture structure from Ollama.');
    }

    if (analysis.layers.length === 0) {
        throw new Error('No architectural layers were identified.');
    }

    const componentIds = new Set<string>();

    for (const layer of analysis.layers) {
        if (
            !layer ||
            typeof layer.name !== 'string' ||
            !Array.isArray(layer.components)
        ) {
            throw new Error('An architectural layer is malformed.');
        }

        for (const component of layer.components) {
            if (
                !component ||
                !component.id ||
                !component.name ||
                !component.description
            ) {
                throw new Error(
                    `Invalid component in layer ${layer.name}.`
                );
            }

            const normalizedId = component.id
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_');

            if (componentIds.has(normalizedId)) {
                throw new Error(
                    `Duplicate component ID: ${normalizedId}`
                );
            }

            component.id = normalizedId;
            componentIds.add(normalizedId);
        }
    }

    analysis.connections = analysis.connections.filter(connection => {
        if (
            !connection ||
            typeof connection.from !== 'string' ||
            typeof connection.to !== 'string'
        ) {
            return false;
        }

        connection.from = connection.from
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');

        connection.to = connection.to
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');

        return (
            componentIds.has(connection.from) &&
            componentIds.has(connection.to) &&
            connection.from !== connection.to
        );
    });

    if (!Array.isArray(analysis.dataFlow)) {
        analysis.dataFlow = [];
    }

    return analysis;
}
