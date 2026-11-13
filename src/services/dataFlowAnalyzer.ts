
import {
    DataFlowAnalysis,
    WorkspaceSnapshot
} from '../utilities/types';

import { callOllama } from './ollamaClient';

export async function analyseDataFlow(
    project: WorkspaceSnapshot
): Promise<DataFlowAnalysis> {

    const prompt = `
You are a senior software architect specializing in
Data Flow Diagrams (DFDs) and software reverse engineering.

Analyze the actual project using its file tree and source code.

Identify how information enters, moves through, gets processed,
and is stored or delivered by the application.

Do not invent databases, APIs, processes or integrations.
Only include elements supported by the supplied evidence.

PROJECT FILE TREE:
${project.tree}

PROJECT SOURCE CODE:
${project.source}

Return ONLY valid JSON in this structure:

{
  "overview": "Description of the actual data flow architecture",
  "nodes": [
    {
      "id": "user",
      "name": "User",
      "type": "external",
      "description": "Provides input to the application",
      "technology": "Unknown"
    },
    {
      "id": "request_processor",
      "name": "Request Processor",
      "type": "process",
      "description": "Validates and processes incoming requests",
      "technology": "Python"
    },
    {
      "id": "database",
      "name": "Database",
      "type": "datastore",
      "description": "Persists application records",
      "technology": "PostgreSQL"
    }
  ],
  "flows": [
    {
      "from": "user",
      "to": "request_processor",
      "label": "Submit request",
      "data": "User input"
    },
    {
      "from": "request_processor",
      "to": "database",
      "label": "Store records",
      "data": "Validated records"
    }
  ]
}

STRICT RULES:

1. Use only these node types:
   - external: users, external applications and third-party systems.
   - process: operations that transform, validate, retrieve
     or transmit information.
   - datastore: databases, persistent files and other
     actual data storage systems.

2. Do not represent every source file as a process.
3. Identify meaningful data-processing operations.
4. Every node must have a unique lowercase ID.
5. IDs may contain only letters, numbers and underscores.
6. Every flow must reference existing node IDs.
7. Only create flows supported by source-code evidence.
8. Do not invent external systems or data stores.
9. Use "Unknown" when technology cannot be established.
10. Keep descriptions concise and factual.
11. Keep flow labels between 2 and 5 words.
12. Keep data descriptions short.
13. Do not duplicate directed flows.
14. Do not create reverse flows unless independently
    supported by the project evidence.
15. Include a meaningful overview.
16. Return JSON only, without Markdown fences.
`;

    const result = await callOllama(prompt, true);

    let parsed: DataFlowAnalysis;

    try {
        const cleaned = result
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        parsed = JSON.parse(cleaned) as DataFlowAnalysis;

    } catch {
        throw new Error(
            'Ollama returned invalid Data Flow analysis JSON.'
        );
    }

    return validateDataFlowAnalysis(parsed);
}

export function validateDataFlowAnalysis(
    analysis: DataFlowAnalysis
): DataFlowAnalysis {

    if (
        !analysis ||
        typeof analysis.overview !== 'string' ||
        !Array.isArray(analysis.nodes) ||
        !Array.isArray(analysis.flows)
    ) {
        throw new Error(
            'Invalid Data Flow analysis structure from Ollama.'
        );
    }

    if (analysis.nodes.length === 0) {
        throw new Error(
            'No data flow elements were identified.'
        );
    }

    const allowedTypes = new Set([
        'external',
        'process',
        'datastore'
    ]);

    const nodeIds = new Set<string>();

    for (const node of analysis.nodes) {

        if (
            !node ||
            typeof node.id !== 'string' ||
            typeof node.name !== 'string' ||
            typeof node.description !== 'string' ||
            !node.id.trim() ||
            !node.name.trim() ||
            !node.description.trim() ||
            !allowedTypes.has(node.type)
        ) {
            throw new Error(
                'Ollama returned a malformed Data Flow node.'
            );
        }

        const normalizedId = node.id
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!normalizedId) {
            throw new Error(
                'A Data Flow node has an invalid ID.'
            );
        }

        if (nodeIds.has(normalizedId)) {
            throw new Error(
                `Duplicate Data Flow node ID: ${normalizedId}`
            );
        }

        node.id = normalizedId;
        node.technology = node.technology || 'Unknown';

        nodeIds.add(normalizedId);
    }

    const uniqueFlows = new Set<string>();

    analysis.flows = analysis.flows.filter(flow => {

        if (
            !flow ||
            typeof flow.from !== 'string' ||
            typeof flow.to !== 'string' ||
            !flow.from.trim() ||
            !flow.to.trim()
        ) {
            return false;
        }

        flow.from = flow.from
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '');

        flow.to = flow.to
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '');

        if (
            !nodeIds.has(flow.from) ||
            !nodeIds.has(flow.to) ||
            flow.from === flow.to
        ) {
            return false;
        }

        const key = `${flow.from}::${flow.to}`;

        if (uniqueFlows.has(key)) {
            return false;
        }

        uniqueFlows.add(key);

        flow.label = (
            typeof flow.label === 'string' && flow.label.trim()
        ) ? flow.label.trim() : 'Data transfer';

        flow.data = (
            typeof flow.data === 'string' && flow.data.trim()
        ) ? flow.data.trim() : 'Application data';

        return true;
    });

    return analysis;
}
