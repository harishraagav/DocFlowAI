
import {
    WorkspaceSnapshot,
    ProjectOverview,
    ProjectModule,
    ProjectEntryPoint
} from '../utilities/types';

import { callOllama } from './ollamaClient';

function extractJSON(response: string): string {
    const cleaned = response
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
        throw new Error(
            'Ollama did not return a valid JSON project overview.'
        );
    }

    return cleaned.slice(start, end + 1);
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter((item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
        .map(item => item.trim());
}

function normalizeModules(value: unknown): ProjectModule[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item =>
            item &&
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            typeof item.path === 'string' &&
            typeof item.responsibility === 'string'
        )
        .map(item => ({
            name: item.name.trim(),
            path: item.path.trim(),
            responsibility: item.responsibility.trim(),
            technologies: normalizeStringArray(item.technologies)
        }));
}

function normalizeEntryPoints(
    value: unknown
): ProjectEntryPoint[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item =>
            item &&
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            typeof item.path === 'string' &&
            typeof item.purpose === 'string'
        )
        .map(item => ({
            name: item.name.trim(),
            path: item.path.trim(),
            purpose: item.purpose.trim()
        }));
}

function validateOverview(
    raw: unknown
): ProjectOverview {

    if (!raw || typeof raw !== 'object') {
        throw new Error('Project overview response is invalid.');
    }

    const data = raw as Record<string, unknown>;

    const requiredFields = [
        'projectName',
        'projectType',
        'purpose',
        'architectureSummary'
    ];

    for (const field of requiredFields) {
        if (
            typeof data[field] !== 'string' ||
            !data[field].trim()
        ) {
            throw new Error(
                `Project overview is missing a valid "${field}" field.`
            );
        }
    }

    return {
        projectName: (data.projectName as string).trim(),
        projectType: (data.projectType as string).trim(),
        purpose: (data.purpose as string).trim(),
        architectureSummary:
            (data.architectureSummary as string).trim(),

        primaryTechnologies:
            normalizeStringArray(data.primaryTechnologies),

        modules:
            normalizeModules(data.modules),

        entryPoints:
            normalizeEntryPoints(data.entryPoints),

        executionFlow:
            normalizeStringArray(data.executionFlow),

        keyFiles:
            normalizeStringArray(data.keyFiles),

        observations:
            normalizeStringArray(data.observations)
    };
}

export async function analyseProjectOverview(
    project: WorkspaceSnapshot
): Promise<ProjectOverview> {

    if (!project.tree.trim()) {
        throw new Error(
            'Cannot analyze an empty workspace.'
        );
    }

    const prompt = `
You are a senior software architect and technical documentation
specialist.

Analyze the supplied project workspace and generate a structured
technical project overview.

Your analysis must be based ONLY on the supplied file tree and
source code.

IMPORTANT ACCURACY RULES:

1. Never invent files, modules, technologies, frameworks, APIs,
   features or execution steps.

2. Identify technologies only when supported by imports,
   configuration files, dependencies or source code.

3. File paths must match the supplied project file tree exactly.

4. Distinguish between confirmed facts and reasonable observations.

5. If an entry point cannot be confidently identified, return
   an empty entryPoints array.

6. Do not assume that the project uses a database, API, frontend,
   backend or cloud service unless there is evidence.

7. Describe the actual implementation, not what the project
   should ideally contain.

8. Do not treat generated documentation, build artifacts or
   dependency folders as core application modules.

9. Keep explanations concise, meaningful and technically accurate.

10. If the available context is incomplete, mention the limitation
    in observations rather than guessing.

ANALYSIS REQUIREMENTS:

A. Project identity
- Project name
- Project type
- Main purpose

B. Architecture
- Overall architecture summary
- Major modules and their responsibilities
- Technologies used by each module

C. Entry points
- Main application entry files
- Startup scripts or executable entry points
- Their actual purposes

D. Execution flow
- Explain how the application starts and operates.
- Present the steps in logical execution order.
- Only include steps supported by the supplied code.

E. Important files
- Identify the most important project files.
- Use exact relative paths from the file tree.

F. Observations
- Important architectural characteristics
- Missing or unclear information
- Potential structural concerns supported by evidence

RETURN STRICT JSON ONLY.

Use exactly this structure:

{
  "projectName": "string",
  "projectType": "string",
  "purpose": "string",
  "architectureSummary": "string",
  "primaryTechnologies": [
    "string"
  ],
  "modules": [
    {
      "name": "string",
      "path": "string",
      "responsibility": "string",
      "technologies": [
        "string"
      ]
    }
  ],
  "entryPoints": [
    {
      "name": "string",
      "path": "string",
      "purpose": "string"
    }
  ],
  "executionFlow": [
    "string"
  ],
  "keyFiles": [
    "string"
  ],
  "observations": [
    "string"
  ]
}

PROJECT FILE TREE:

${project.tree}

PROJECT SOURCE CODE:

${project.source}
`;

    const response = await callOllama(prompt, true);

    let parsed: unknown;

    try {
        parsed = JSON.parse(extractJSON(response));
    } catch (error) {
        console.error(
            '[DocFlowAI] Project Overview JSON parsing failed:',
            error
        );

        throw new Error(
            'Could not parse the project overview returned by Ollama.'
        );
    }

    const analysis = validateOverview(parsed);

    console.log(
        '[DocFlowAI] Project Overview Analysis:',
        analysis.projectName,
        '|',
        analysis.modules.length,
        'modules,',
        analysis.entryPoints.length,
        'entry points.'
    );

    return analysis;
}
