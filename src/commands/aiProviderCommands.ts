import * as vscode from 'vscode';
import { generateAI, type AIProviderId } from '../services/aiProvider';
import {
    deleteProviderAPIKey,
    discoverGeminiModels,
    discoverGroqModels,
    saveProviderAPIKey,
    type CloudProviderId
} from '../services/cloudAIProvider';
import {
    discoverOllamaModels
} from '../services/ollamaProvider';

const CONNECTION_TEST_PROMPT =
    'Reply with exactly this text and nothing else: DocFlowAI connection successful.';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function testCurrentProvider(): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'DocFlowAI: Testing AI connection...',
                cancellable: false
            },
            async () => {
                await generateAI(CONNECTION_TEST_PROMPT);
            }
        );

        vscode.window.showInformationMessage(
            'DocFlowAI: AI connection successful.'
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `DocFlowAI: AI connection failed: ${getErrorMessage(error)}`
        );
    }
}

async function configureAIProvider(): Promise<void> {
    const providers: Array<vscode.QuickPickItem & { id: AIProviderId }> = [
        {
            label: 'Ollama',
            description: 'Run models locally on your computer',
            id: 'ollama'
        },
        {
            label: 'Groq',
            description: 'Use your own Groq API key',
            id: 'groq'
        },
        {
            label: 'Google Gemini',
            description: 'Use your own Gemini API key',
            id: 'gemini'
        }
    ];

    const selectedProvider = await vscode.window.showQuickPick(providers, {
        title: 'DocFlowAI — Choose AI Provider',
        placeHolder: 'Select the AI provider you want to use'
    });

    if (!selectedProvider) {return;}

    const provider = selectedProvider.id;

    try {
        let modelNames: string[];

        if (provider === 'ollama') {
            const models = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'DocFlowAI: Discovering local Ollama models...',
                    cancellable: false
                },
                () => discoverOllamaModels()
            );

            modelNames = models.map(model => model.name);

            if (modelNames.length === 0) {
                vscode.window.showWarningMessage(
                    'DocFlowAI: No Ollama models were found. Start Ollama and pull a model before continuing.'
                );
                return;
            }
        } else {
            const cloudProvider = provider as CloudProviderId;
            const providerName = provider === 'groq' ? 'Groq' : 'Google Gemini';

            const apiKey = await vscode.window.showInputBox({
                title: `DocFlowAI — ${providerName} API Key`,
                prompt: `Enter your ${providerName} API key. It will be stored securely in VS Code SecretStorage.`,
                password: true,
                ignoreFocusOut: true,
                validateInput: value =>
                    value.trim().length === 0
                        ? 'Please enter a valid API key.'
                        : undefined
            });

            if (!apiKey) {return;}

            await saveProviderAPIKey(cloudProvider, apiKey);

            vscode.window.showInformationMessage(
                `DocFlowAI: ${providerName} API key saved securely.`
            );

            modelNames = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `DocFlowAI: Discovering ${providerName} models...`,
                    cancellable: false
                },
                () =>
                    provider === 'groq'
                        ? discoverGroqModels()
                        : discoverGeminiModels()
            );

            if (modelNames.length === 0) {
                vscode.window.showWarningMessage(
                    `DocFlowAI: No compatible ${providerName} models were returned by the API.`
                );
                return;
            }
        }

        const selectedModel = await vscode.window.showQuickPick(
            modelNames.map(name => ({
                label: name,
                description: name === getConfiguredModel(provider)
                    ? 'Currently configured'
                    : undefined
            })),
            {
                title: 'DocFlowAI — Select AI Model',
                placeHolder: 'Choose the model DocFlowAI should use',
                matchOnDescription: true
            }
        );

        if (!selectedModel) {return;}

        const config = vscode.workspace.getConfiguration('docflowai.ai');

        await config.update(
            `${provider}.model`,
            selectedModel.label,
            vscode.ConfigurationTarget.Global
        );

        await config.update(
            'provider',
            provider,
            vscode.ConfigurationTarget.Global
        );

        vscode.window.showInformationMessage(
            `DocFlowAI: ${provider} is now selected with model ${selectedModel.label}.`
        );

        const testNow = await vscode.window.showInformationMessage(
            'Would you like to test this AI connection now?',
            'Test Connection',
            'Later'
        );

        if (testNow === 'Test Connection') {
            await testCurrentProvider();
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `DocFlowAI: Provider setup failed: ${getErrorMessage(error)}`
        );
    }
}

function getConfiguredModel(provider: AIProviderId): string {
    const config = vscode.workspace.getConfiguration('docflowai.ai');

    switch (provider) {
        case 'ollama':
            return config.get<string>('ollama.model', 'llama3.2');
        case 'groq':
            return config.get<string>('groq.model', 'openai/gpt-oss-20b');
        case 'gemini':
            return config.get<string>('gemini.model', 'gemini-3.8-flash');
    }
}

async function removeCloudAPIKey(): Promise<void> {
    const providers: Array<vscode.QuickPickItem & { id: CloudProviderId }> = [
        {
            label: 'Groq',
            description: 'Remove the saved Groq API key',
            id: 'groq'
        },
        {
            label: 'Google Gemini',
            description: 'Remove the saved Gemini API key',
            id: 'gemini'
        }
    ];

    const selected = await vscode.window.showQuickPick(providers, {
        title: 'DocFlowAI — Remove API Key',
        placeHolder: 'Choose which saved API key to remove'
    });

    if (!selected) {return;}

    const providerName = selected.id === 'groq' ? 'Groq' : 'Google Gemini';

    const confirmation = await vscode.window.showWarningMessage(
        `Remove the saved ${providerName} API key from VS Code secure storage?`,
        { modal: true },
        'Remove Key'
    );

    if (confirmation !== 'Remove Key') {return;}

    try {
        await deleteProviderAPIKey(selected.id);

        vscode.window.showInformationMessage(
            `DocFlowAI: The ${providerName} API key was removed.`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `DocFlowAI: Could not remove API key: ${getErrorMessage(error)}`
        );
    }
}

export function registerAIProviderCommands(
    context: vscode.ExtensionContext
): void {
    const configure = vscode.commands.registerCommand(
        'docflowai.configureAIProvider',
        configureAIProvider
    );

    const test = vscode.commands.registerCommand(
        'docflowai.testAIConnection',
        testCurrentProvider
    );

    const removeKey = vscode.commands.registerCommand(
        'docflowai.removeAIAPIKey',
        removeCloudAPIKey
    );

    context.subscriptions.push(configure, test, removeKey);
}