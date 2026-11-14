
import * as vscode from 'vscode';

export interface OllamaModel {
    name: string;
    size: number;
    modifiedAt: string;
}

interface OllamaGenerateResponse {
    response?: string;
    error?: string;
}

interface OllamaTagsResponse {
    models?: Array<{
        name?: string;
        size?: number;
        modified_at?: string;
    }>;
}

function getOllamaConfig(): {
    url: string;
    model: string;
} {
    const config = vscode.workspace.getConfiguration('docflowai.ai');

    return {
        url: config.get<string>(
            'ollama.url',
            'http://localhost:11434'
        ).replace(/\/+$/, ''),
        model: config.get<string>(
            'ollama.model',
            'llama3.2'
        )
    };
}

export async function generateWithOllama(
    prompt: string,
    jsonMode = false
): Promise<string> {
    const config = getOllamaConfig();

    const response = await fetch(`${config.url}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: config.model,
            prompt,
            stream: false,
            ...(jsonMode ? { format: 'json' } : {}),
            options: {
                temperature: 0.1
            }
        }),
        signal: AbortSignal.timeout(180_000)
    });

    if (!response.ok) {
        throw new Error(
            `Ollama returned HTTP ${response.status}. ` +
            'Check that Ollama is running and the selected model is available.'
        );
    }

    const result = await response.json() as OllamaGenerateResponse;

    if (result.error) {
        throw new Error(`Ollama error: ${result.error}`);
    }

    if (!result.response?.trim()) {
        throw new Error('Ollama returned an empty response.');
    }

    return result.response;
}

export async function discoverOllamaModels(): Promise<OllamaModel[]> {
    const config = getOllamaConfig();

    const response = await fetch(`${config.url}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
        throw new Error(
            `Unable to retrieve Ollama models. HTTP ${response.status}.`
        );
    }

    const result = await response.json() as OllamaTagsResponse;

    return (result.models ?? [])
        .filter((model): model is {
            name: string;
            size?: number;
            modified_at?: string;
        } => typeof model.name === 'string' && model.name.length > 0)
        .map(model => ({
            name: model.name,
            size: model.size ?? 0,
            modifiedAt: model.modified_at ?? ''
        }));
}

export async function testOllamaConnection(): Promise<boolean> {
    const models = await discoverOllamaModels();
    return models.length > 0;
}
