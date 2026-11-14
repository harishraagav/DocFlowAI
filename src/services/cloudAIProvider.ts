
import * as vscode from 'vscode';
import { getExtensionContext } from './aiProvider';

export type CloudProviderId = 'groq' | 'gemini';

interface GroqResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
}

interface GroqModelsResponse {
    data?: Array<{
        id?: string;
        active?: boolean;
    }>;
}

interface GeminiModelsResponse {
    models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
    }>;
}

function getConfig() {
    return vscode.workspace.getConfiguration('docflowai.ai');
}

export async function saveProviderAPIKey(
    provider: CloudProviderId,
    apiKey: string
): Promise<void> {
    const normalizedKey = apiKey.trim();

    if (!normalizedKey) {
        throw new Error('API key cannot be empty.');
    }

    const context = getExtensionContext();

    await context.secrets.store(
        `docflowai.${provider}.apiKey`,
        normalizedKey
    );
}

export async function hasProviderAPIKey(
    provider: CloudProviderId
): Promise<boolean> {
    const context = getExtensionContext();

    const apiKey = await context.secrets.get(
        `docflowai.${provider}.apiKey`
    );

    return Boolean(apiKey);
}

export async function getProviderAPIKey(
    provider: CloudProviderId
): Promise<string> {
    const context = getExtensionContext();

    const apiKey = await context.secrets.get(
        `docflowai.${provider}.apiKey`
    );

    if (!apiKey) {
        throw new Error(
            `No ${provider} API key configured. ` +
            'Open DocFlowAI provider settings to add your key.'
        );
    }

    return apiKey;
}

export async function deleteProviderAPIKey(
    provider: CloudProviderId
): Promise<void> {
    const context = getExtensionContext();

    await context.secrets.delete(
        `docflowai.${provider}.apiKey`
    );
}


export async function generateWithGroq(
    prompt: string,
    jsonMode = false
): Promise<string> {
    const apiKey = await getProviderAPIKey('groq');
    const model = getConfig().get<string>(
        'groq.model',
        'openai/gpt-oss-20b'
    );

    const messages = jsonMode
        ? [
            {
                role: 'system',
                content:
                    'You must respond with valid JSON only. ' +
                    'Return a valid JSON object or array as requested. ' +
                    'Do not include Markdown fences or explanations.'
            },
            {
                role: 'user',
                content: prompt
            }
        ]
        : [
            {
                role: 'user',
                content: prompt
            }
        ];

    const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.1,
                ...(jsonMode
                    ? {
                        response_format: {
                            type: 'json_object'
                        }
                    }
                    : {})
            }),
            signal: AbortSignal.timeout(180_000)
        }
    );

    const result = await response.json() as GroqResponse;

    if (!response.ok) {
        throw new Error(
            `Groq request failed (HTTP ${response.status}): ` +
            `${result.error?.message ?? 'Unknown API error.'}`
        );
    }

    const content = result.choices?.[0]?.message?.content;

    if (!content?.trim()) {
        throw new Error('Groq returned an empty response.');
    }

    return content;
}


export async function generateWithGemini(
    prompt: string,
    jsonMode = false
): Promise<string> {
    const apiKey = await getProviderAPIKey('gemini');

    const model = getConfig().get<string>(
        'gemini.model',
        'gemini-3.8-flash'
    );

    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                ...(jsonMode
                    ? { responseMimeType: 'application/json' }
                    : {})
            }
        }),
        signal: AbortSignal.timeout(180_000)
    });

    const result = await response.json() as GeminiResponse;

    if (!response.ok) {
        throw new Error(
            `Gemini request failed (HTTP ${response.status}): ` +
            (result.error?.message ?? 'Unknown API error.')
        );
    }

    const content = result.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? '')
        .join('');

    if (!content?.trim()) {
        throw new Error('Gemini returned an empty response.');
    }

    return content;
}

export async function discoverGroqModels(): Promise<string[]> {
    const apiKey = await getProviderAPIKey('groq');

    const response = await fetch(
        'https://api.groq.com/openai/v1/models',
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            signal: AbortSignal.timeout(20_000)
        }
    );

    if (!response.ok) {
        throw new Error(
            `Groq model discovery failed (HTTP ${response.status}).`
        );
    }

    const result = await response.json() as GroqModelsResponse;

    return (result.data ?? [])
        .filter(model => model.id && model.active !== false)
        .map(model => model.id as string)
        .sort();
}

export async function discoverGeminiModels(): Promise<string[]> {
    const apiKey = await getProviderAPIKey('gemini');

    const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        {
            headers: {
                'x-goog-api-key': apiKey
            },
            signal: AbortSignal.timeout(20_000)
        }
    );

    if (!response.ok) {
        throw new Error(
            `Gemini model discovery failed (HTTP ${response.status}).`
        );
    }

    const result = await response.json() as GeminiModelsResponse;

    return (result.models ?? [])
        .filter(model =>
            model.name &&
            model.supportedGenerationMethods?.includes('generateContent')
        )
        .map(model => (model.name as string).replace(/^models\//, ''))
        .sort();
}
