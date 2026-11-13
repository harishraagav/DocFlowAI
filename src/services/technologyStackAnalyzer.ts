
import {
    WorkspaceSnapshot,
    TechnologyStackAnalysis,
    TechnologyStackItem
} from '../utilities/types';

import { callOllama } from './ollamaClient';

function extractJSON(response: string): string {
    const cleaned = response
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end <= start) {
        throw new Error('Ollama returned invalid technology analysis JSON.');
    }

    return cleaned.slice(start, end + 1);
}

export async function analyseTechnologyStack(
    project: WorkspaceSnapshot
): Promise<TechnologyStackAnalysis> {

    if (!project.tree.trim()) {
        throw new Error('Cannot analyze an empty workspace.');
    }

    const prompt = `
You are a senior software architect performing technology stack detection.

Analyze the supplied project file tree and source code.

ACCURACY RULES:
1. Identify only technologies supported by actual evidence.
2. Inspect imports, package manifests, configuration and source code.
3. Do not confuse programming languages with frameworks.
4. Do not identify a technology merely because it is commonly used with another.
5. Distinguish installed dependencies from technologies actually used.
6. Do not invent versions. Include versions only when explicitly available.
7. Do not classify development tools as runtime frameworks.
8. Avoid duplicate technologies.
9. Include evidence using exact file paths or identifiable imports/configuration.
10. Use confidence high, medium or low based on the strength of evidence.
11. Mention incomplete workspace context in observations.
12. Do not invent project files or features.

CATEGORIES MAY INCLUDE:
- Programming Language
- Frontend
- Backend
- Database
- AI / Machine Learning
- Cloud / Hosting
- DevOps / Build Tools
- Testing
- Libraries
- Other

For each technology explain its actual purpose in this project.

Return STRICT JSON ONLY:

{
  "projectName": "string",
  "summary": "string",
  "technologies": [
    {
      "name": "string",
      "category": "string",
      "purpose": "string",
      "evidence": ["string"],
      "confidence": "high"
    }
  ],
  "observations": ["string"]
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
        console.error('[DocFlowAI] Technology Stack JSON error:', error);
        throw new Error('Could not parse technology stack analysis.');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Technology stack analysis is invalid.');
    }

    const data = parsed as Record<string, unknown>;

    if (
        typeof data.projectName !== 'string' ||
        typeof data.summary !== 'string' ||
        !Array.isArray(data.technologies)
    ) {
        throw new Error('Technology stack response is missing required fields.');
    }

    
    const technologies: TechnologyStackItem[] =
        data.technologies
            .filter((item): item is Record<string, unknown> => {
                if (!item || typeof item !== 'object') {
                    return false;
                }

                const technology = item as Record<string, unknown>;

                return (
                    typeof technology.name === 'string' &&
                    typeof technology.category === 'string' &&
                    typeof technology.purpose === 'string'
                );
            })
            .map(item => {
                const name = item.name as string;
                const category = item.category as string;
                const purpose = item.purpose as string;

                return {
                    name: name.trim(),
                    category: category.trim(),
                    purpose: purpose.trim(),
                    evidence: Array.isArray(item.evidence)
                        ? item.evidence.filter(
                            (value): value is string =>
                                typeof value === 'string'
                        )
                        : [],
                    confidence:
                        item.confidence === 'high' ||
                        item.confidence === 'medium'
                            ? item.confidence
                            : 'low'
                };
            });


    const observations = Array.isArray(data.observations)
        ? data.observations.filter(
            (value): value is string => typeof value === 'string'
        )
        : [];

    return {
        projectName: data.projectName.trim(),
        summary: data.summary.trim(),
        technologies,
        observations
    };
}
