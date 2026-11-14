
import * as vscode from 'vscode';
import { generateWithOllama } from './ollamaProvider';
import {
    generateWithGroq,
    generateWithGemini
} from './cloudAIProvider';

export type AIProviderId = 'ollama' | 'groq' | 'gemini';

export interface AIRequestOptions {
    jsonMode?: boolean;
}

let extensionContext: vscode.ExtensionContext | undefined;

export function initializeAIProvider(
    context: vscode.ExtensionContext
): void {
    extensionContext = context;
}

export function getExtensionContext():
    vscode.ExtensionContext {
    if (!extensionContext) {
        throw new Error(
            'DocFlowAI AI provider has not been initialized.'
        );
    }

    return extensionContext;
}

export async function generateAI(
    prompt: string,
    options: AIRequestOptions = {}
): Promise<string> {
    if (!prompt.trim()) {
        throw new Error('AI prompt cannot be empty.');
    }

    const config = vscode.workspace.getConfiguration('docflowai.ai');
    const provider = config.get<AIProviderId>('provider', 'ollama');
    const jsonMode = options.jsonMode ?? false;

    switch (provider) {
        case 'ollama':
            return generateWithOllama(prompt, jsonMode);

        case 'groq':
            return generateWithGroq(prompt, jsonMode);

        case 'gemini':
            return generateWithGemini(prompt, jsonMode);

        default:
            throw new Error(
                `Unsupported AI provider: ${provider}`
            );
    }
}
