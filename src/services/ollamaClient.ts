
const OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function callOllama(
    prompt: string,
    jsonMode = false
): Promise<string> {
    const config = vscodeConfig();

    const response = await fetch(config.url, {
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
            'Check that Ollama is running and the model is installed.'
        );
    }

    const result = await response.json() as {
        response?: string;
        error?: string;
    };

    if (result.error) {
        throw new Error(result.error);
    }

    if (!result.response?.trim()) {
        throw new Error('Ollama returned an empty response.');
    }

    return result.response;
}

function vscodeConfig(): {
    url: string;
    model: string;
} {
    return {
        url: OLLAMA_URL,
        model: 'llama3.2'
    };
}
