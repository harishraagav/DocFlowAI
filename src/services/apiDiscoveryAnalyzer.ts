
import {
    WorkspaceSnapshot,
    ApiDiscoveryAnalysis,
    ApiEndpoint,
    ApiDependency
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
        throw new Error('Ollama returned invalid API discovery JSON.');
    }

    return cleaned.slice(start, end + 1);
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter(
            (item): item is string =>
                typeof item === 'string' && item.trim().length > 0
        )
        .map(item => item.trim());
}

function normalizeEndpoints(value: unknown): ApiEndpoint[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item => {
            if (!item || typeof item !== 'object') return false;

            const endpoint = item as Record<string, unknown>;

            return (
                typeof endpoint.name === 'string' &&
                typeof endpoint.method === 'string' &&
                typeof endpoint.path === 'string' &&
                typeof endpoint.file === 'string' &&
                (
                    endpoint.kind === 'server-route' ||
                    endpoint.kind === 'client-request'
                )
            );
        })
        .map(item => {
            const endpoint = item as Record<string, unknown>;

            return {
                name: (endpoint.name as string).trim(),
                method: (endpoint.method as string).trim().toUpperCase(),
                path: (endpoint.path as string).trim(),
                kind: endpoint.kind as
                    'server-route' | 'client-request',
                handler: typeof endpoint.handler === 'string'
                    ? endpoint.handler.trim()
                    : 'Not identified',
                file: (endpoint.file as string).trim(),
                purpose: typeof endpoint.purpose === 'string'
                    ? endpoint.purpose.trim()
                    : 'Not identified',
                requestParameters: stringArray(endpoint.requestParameters),
                requestBodyFields: stringArray(endpoint.requestBodyFields),
                responseDescription:
                    typeof endpoint.responseDescription === 'string'
                        ? endpoint.responseDescription.trim()
                        : 'Not identified',
                authentication:
                    typeof endpoint.authentication === 'string'
                        ? endpoint.authentication.trim()
                        : 'Not identified',
                evidence: stringArray(endpoint.evidence)
            };
        });
}

function normalizeDependencies(value: unknown): ApiDependency[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item => {
            if (!item || typeof item !== 'object') return false;

            const dependency = item as Record<string, unknown>;

            return (
                typeof dependency.sourceEndpoint === 'string' &&
                typeof dependency.targetEndpoint === 'string' &&
                typeof dependency.description === 'string'
            );
        })
        .map(item => {
            const dependency = item as Record<string, unknown>;

            return {
                sourceEndpoint:
                    (dependency.sourceEndpoint as string).trim(),
                targetEndpoint:
                    (dependency.targetEndpoint as string).trim(),
                description:
                    (dependency.description as string).trim()
            };
        });
}

/**
 * Find a source file using the exact relative path supplied by Ollama.
 */

function getSourceFile(
    source: string,
    filePath: string
): string | undefined {

    const normalizedPath = filePath
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '');

    const files = source.split(
        /\n\s*={3,}\s*FILE:\s*(.*?)\s*={3,}\s*\n/
    );

    for (let i = 1; i < files.length; i += 2) {

        const discoveredPath = files[i]
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\.\/+/, '');

        if (
            discoveredPath.toLowerCase() ===
            normalizedPath.toLowerCase()
        ) {
            return files[i + 1] ?? '';
        }
    }

    return undefined;
}


/**
 * Deterministic evidence validation.
 *
 * These checks are intentionally conservative.
 * Unsupported endpoints are discarded instead of guessed.
 */
function hasServerRouteEvidence(
    fileContent: string,
    endpoint: ApiEndpoint
): boolean {

    const path = endpoint.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const method = endpoint.method;

    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'UNKNOWN'].includes(method)) {
        return false;
    }

    const routePatterns = [
        // Flask, FastAPI and similar decorators
        new RegExp(
            `@\\w+\\.(?:route|get|post|put|patch|delete|api_route)\\s*\\(\\s*["'\x60]${path}["'\x60]`,
            'i'
        ),

        // Express, Router and similar registrations
        new RegExp(
            `\\b\\w+\\.(?:get|post|put|patch|delete|all)\\s*\\(\\s*["'\x60]${path}["'\x60]`,
            'i'
        ),

        // Django path/re_path registrations
        new RegExp(
            `\\b(?:path|re_path)\\s*\\(\\s*["'\x60]${path}["'\x60]`,
            'i'
        ),

        // Generic router registration
        new RegExp(
            `\\brouter\\.(?:add_api_route|add_route)\\s*\\(\\s*["'\x60]${path}["'\x60]`,
            'i'
        )
    ];

    return routePatterns.some(pattern => pattern.test(fileContent));
}

function hasClientRequestEvidence(
    fileContent: string,
    endpoint: ApiEndpoint
): boolean {

    const method = endpoint.method;

    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'UNKNOWN'].includes(method)) {
        return false;
    }

    const requestPatterns = [
        // JavaScript fetch
        /\bfetch\s*\(/i,

        // Axios methods
        /\baxios\s*(?:\.\s*(?:get|post|put|patch|delete|request))?\s*\(/i,

        // Python requests/httpx
        /\b(?:requests|httpx)\s*\.\s*(?:get|post|put|patch|delete|request)\s*\(/i,

        // Python urllib
        /\burllib\.request\.(?:urlopen|Request)\s*\(/i,

        // Node HTTP clients
        /\b(?:http|https)\.request\s*\(/i
    ];

    return requestPatterns.some(pattern => pattern.test(fileContent));
}

function validateEndpointEvidence(
    endpoints: ApiEndpoint[],
    project: WorkspaceSnapshot
): {
    valid: ApiEndpoint[];
    rejected: string[];
} {

    const valid: ApiEndpoint[] = [];
    const rejected: string[] = [];

    for (const endpoint of endpoints) {

        if (
            !endpoint.name ||
            !endpoint.path ||
            !endpoint.file ||
            !endpoint.method
        ) {
            rejected.push(`${endpoint.name || 'Unnamed endpoint'}: incomplete metadata.`);
            continue;
        }

        if (
            endpoint.method === 'NONE' ||
            endpoint.method === 'NULL' ||
            endpoint.method === 'UNDEFINED'
        ) {
            rejected.push(`${endpoint.name}: invalid HTTP method.`);
            continue;
        }

        const fileContent = getSourceFile(
            project.source,
            endpoint.file
        );

        if (!fileContent) {
            rejected.push(
                `${endpoint.name}: source file could not be verified.`
            );
            continue;
        }

        const verified = endpoint.kind === 'server-route'
            ? hasServerRouteEvidence(fileContent, endpoint)
            : hasClientRequestEvidence(fileContent, endpoint);

        if (!verified) {
            rejected.push(
                `${endpoint.name}: no matching HTTP or route-registration evidence.`
            );
            continue;
        }

        valid.push(endpoint);
    }

    return { valid, rejected };
}

export async function analyseApiDiscovery(
    project: WorkspaceSnapshot
): Promise<ApiDiscoveryAnalysis> {

    if (!project.tree.trim()) {
        throw new Error('Cannot analyze an empty workspace.');
    }

    const prompt = `
You are a senior backend engineer performing source-code API discovery.

Your task is to identify ONLY actual HTTP API endpoints and HTTP requests.

CRITICAL DISTINCTION:

A normal programming function is NOT an API endpoint.

Examples that MUST NOT be classified as APIs:

- def format_reviews(reviews):
- format_reviews(raw_reviews)
- chain.invoke(...)
- retriever.invoke(...)
- database.query(...)
- vector_store.add_documents(...)
- ordinary function calls
- class methods without HTTP route registration

A function becomes an API endpoint only when it is explicitly registered
with an HTTP server/router or equivalent framework mechanism.

SERVER ROUTE EVIDENCE:

Examples include:

Python:
@app.route("/users", methods=["GET"])
@app.get("/users")
@app.post("/users")
@router.get("/users")
path("users/", views.users)

JavaScript:
app.get("/users", handler)
router.post("/users", handler)

Other frameworks:
Only report routes when actual route registration is visible.

CLIENT REQUEST EVIDENCE:

Examples include:

fetch("/api/users")
axios.get("/api/users")
requests.get("https://example.com")
httpx.post("https://example.com")

ACCURACY RULES:

1. Analyze only supplied source code and file tree.
2. Never invent paths or HTTP methods.
3. Every reported endpoint must have visible HTTP evidence.
4. Distinguish server routes from client requests.
5. Do not classify ordinary functions as routes.
6. Do not classify database or vector database operations as HTTP requests.
7. Do not classify LangChain invoke() calls as HTTP requests.
8. Do not count documentation examples or comments as implementation.
9. Use exact relative file paths.
10. Include only identifiable parameters and body fields.
11. Never assume authentication.
12. Do not create artificial paths for functions.
13. If no HTTP routes or requests exist, return an empty endpoints array.
14. Do not use "NONE" as an HTTP method.
15. Use "UNKNOWN" only when a genuine HTTP request or route exists
    but its method cannot be determined.
16. Dependencies must connect actual discovered HTTP endpoints only.
17. Never invent evidence.

ENDPOINT TYPES:

- server-route: Registered HTTP endpoint served by this application.
- client-request: Actual outgoing HTTP request made by this application.

IMPORTANT:
A local RAG pipeline using retriever.invoke(), chain.invoke(),
OllamaLLM or ChromaDB is not automatically an API.

RETURN STRICT JSON ONLY:

{
  "projectName": "string",
  "summary": "string",
  "endpoints": [
    {
      "name": "string",
      "method": "GET",
      "path": "/example",
      "kind": "server-route",
      "handler": "functionName",
      "file": "src/example.py",
      "purpose": "string",
      "requestParameters": [],
      "requestBodyFields": [],
      "responseDescription": "string",
      "authentication": "Not identified",
      "evidence": []
    }
  ],
  "dependencies": [],
  "observations": []
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
        console.error('[DocFlowAI] API Discovery JSON error:', error);
        throw new Error('Could not parse API discovery analysis.');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('API discovery response is invalid.');
    }

    const data = parsed as Record<string, unknown>;

    if (
        typeof data.projectName !== 'string' ||
        typeof data.summary !== 'string' ||
        !Array.isArray(data.endpoints)
    ) {
        throw new Error('API discovery response is missing required fields.');
    }

    const normalized = normalizeEndpoints(data.endpoints);

    const validation = validateEndpointEvidence(
        normalized,
        project
    );

    const observations = stringArray(data.observations);

    if (validation.rejected.length > 0) {
        observations.push(
            `DocFlowAI rejected ${validation.rejected.length} unverified API candidate(s) because matching HTTP route or request evidence could not be confirmed.`
        );

        console.warn(
            '[DocFlowAI] Rejected API candidates:',
            validation.rejected
        );
    }

    if (validation.valid.length === 0) {
        observations.push(
            'No API endpoints or outgoing HTTP requests could be verified from the supplied source code.'
        );
    }

    const analysis: ApiDiscoveryAnalysis = {
        projectName: data.projectName.trim(),
        summary: data.summary.trim(),
        endpoints: validation.valid,
        dependencies: validation.valid.length > 0
            ? normalizeDependencies(data.dependencies)
            : [],
        observations
    };

    console.log(
        '[DocFlowAI] API Discovery:',
        analysis.endpoints.length,
        'verified endpoints identified.'
    );

    return analysis;
}
