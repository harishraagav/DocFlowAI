
import {
    SequenceAnalysis,
    WorkspaceSnapshot
} from '../utilities/types';

import { callOllama } from './ollamaClient';

export async function analyseSequence(
    project: WorkspaceSnapshot
): Promise<SequenceAnalysis> {

    const prompt = `
You are a senior software architect specializing in UML
sequence diagrams and source-code reverse engineering.

Analyze the ACTUAL project using its file tree and source code.

Identify a realistic runtime interaction sequence.

PROJECT FILE TREE:
${project.tree}

PROJECT SOURCE CODE:
${project.source}

Return ONLY valid JSON in this structure:

{
  "overview": "Description of the interaction sequence",
  "participants": [
    {
      "id": "user",
      "name": "User",
      "technology": "Human",
      "type": "Actor"
    },
    {
      "id": "frontend",
      "name": "Frontend",
      "technology": "React",
      "type": "Application"
    }
  ],
  "messages": [
    {
      "from": "user",
      "to": "frontend",
      "label": "Submits login request",
      "type": "sync"
    },
    {
      "from": "frontend",
      "to": "backend",
      "label": "POST /login",
      "type": "sync"
    },
    {
      "from": "backend",
      "to": "frontend",
      "label": "Returns authentication result",
      "type": "return"
    }
  ]
}

Rules:
1. Include only participants supported by project evidence.
2. Do not invent APIs, databases, services or technologies.
3. Identify actual function calls, requests, responses and data access.
4. Messages must be in chronological execution order.
5. Every message must reference existing participant IDs.
6. Participant IDs must be unique lowercase identifiers.
7. Use only these message types: sync, async, return.
8. Use concise, technically accurate message labels.
9. Prefer one meaningful primary execution flow.
10. Include 3-10 participants and 4-18 messages where evidence permits.
11. If the project has no identifiable runtime flow, explain that in overview.
12. Return JSON only. No Markdown fences.
`;

    const result = await callOllama(prompt, true);

    let parsed: SequenceAnalysis;

    try {
        const cleaned = result
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        parsed = JSON.parse(cleaned) as SequenceAnalysis;
    } catch {
        throw new Error(
            'Ollama returned invalid sequence analysis JSON.'
        );
    }

    return validateSequenceAnalysis(parsed);
}

function validateSequenceAnalysis(
    analysis: SequenceAnalysis
): SequenceAnalysis {

    if (
        !analysis ||
        typeof analysis.overview !== 'string' ||
        !Array.isArray(analysis.participants) ||
        !Array.isArray(analysis.messages)
    ) {
        throw new Error(
            'Invalid sequence analysis structure from Ollama.'
        );
    }

    if (analysis.participants.length < 2) {
        throw new Error(
            'Not enough participants were identified for a sequence diagram.'
        );
    }

    const usedIds = new Set<string>();

    for (const participant of analysis.participants) {

        if (
            !participant ||
            typeof participant.id !== 'string' ||
            typeof participant.name !== 'string' ||
            !participant.id.trim() ||
            !participant.name.trim()
        ) {
            throw new Error(
                'A sequence diagram participant is malformed.'
            );
        }

        const normalizedId = participant.id
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!normalizedId || usedIds.has(normalizedId)) {
            throw new Error(
                `Invalid or duplicate sequence participant ID: ${normalizedId}`
            );
        }

        participant.id = normalizedId;
        participant.technology =
            participant.technology || 'Unknown';
        participant.type = participant.type || 'Component';

        usedIds.add(normalizedId);
    }

    analysis.messages = analysis.messages.filter(message => {

        if (
            !message ||
            typeof message.from !== 'string' ||
            typeof message.to !== 'string' ||
            typeof message.label !== 'string'
        ) {
            return false;
        }

        message.from = message.from
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '');

        message.to = message.to
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '');

        if (
            !usedIds.has(message.from) ||
            !usedIds.has(message.to) ||
            message.from === message.to
        ) {
            return false;
        }

        if (
            !['sync', 'async', 'return'].includes(message.type)
        ) {
            message.type = 'sync';
        }

        message.label = message.label.trim().slice(0, 100);

        return message.label.length > 0;
    });

    if (analysis.messages.length === 0) {
        throw new Error(
            'No valid interactions were identified in the project.'
        );
    }

    return analysis;
}
