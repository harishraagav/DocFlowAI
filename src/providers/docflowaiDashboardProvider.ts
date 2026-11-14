
import * as vscode from 'vscode';

import {
    AIProviderId,
    generateAI
} from '../services/aiProvider';

import {
    saveProviderAPIKey,
    hasProviderAPIKey,
    deleteProviderAPIKey,
    discoverGroqModels,
    discoverGeminiModels,
    generateWithGroq,
    generateWithGemini
} from '../services/cloudAIProvider';

import {
    discoverOllamaModels,
    generateWithOllama
} from '../services/ollamaProvider';

interface DashboardCommand {
    id: string;
    title: string;
    description: string;
    category: string;
}

const PROVIDERS: AIProviderId[] = [
    'ollama',
    'groq',
    'gemini'
];

const COMMANDS: DashboardCommand[] = [
    { id: 'docflowai.generateSystemArchitecture', title: 'System Architecture', description: 'Generate a complete system architecture map.', category: 'Documentation' },
    { id: 'docflowai.generateComponentDiagram', title: 'Component Diagram', description: 'Visualize software components.', category: 'Documentation' },
    { id: 'docflowai.generateDataFlowDiagram', title: 'Data Flow Diagram', description: 'Visualize how data moves through the project.', category: 'Documentation' },
    { id: 'docflowai.generateSequenceDiagram', title: 'Sequence Diagram', description: 'Generate interaction sequence diagrams.', category: 'Documentation' },
    { id: 'docflowai.generateERDiagram', title: 'Database ER Diagram', description: 'Generate database entity relationship diagrams.', category: 'Documentation' },
    { id: 'docflowai.generateProjectOverview', title: 'Project Overview', description: 'Generate a comprehensive project overview.', category: 'Documentation' },
    { id: 'docflowai.generateReadme', title: 'Generate README', description: 'Create or update the project README.', category: 'Documentation' },
    { id: 'docflowai.generateApiDocumentation', title: 'API Documentation', description: 'Generate API documentation.', category: 'Documentation' },
    { id: 'docflowai.generateTechnicalDocumentation', title: 'Technical Documentation', description: 'Generate technical project documentation.', category: 'Documentation' },
    { id: 'docflowai.generateOnboardingGuide', title: 'Developer Onboarding', description: 'Generate a guide for new developers.', category: 'Documentation' },
    { id: 'docflowai.documentCurrentFile', title: 'Document Current File', description: 'Generate documentation for the active file.', category: 'Code Intelligence' },
    { id: 'docflowai.explainCode', title: 'Explain Selected Code', description: 'Explain the selected source code.', category: 'Code Intelligence' },
    { id: 'docflowai.findDependencies', title: 'Find Code Dependencies', description: 'Find dependencies of the selected code.', category: 'Code Intelligence' },
    { id: 'docflowai.documentFunctions', title: 'Document Functions', description: 'Generate function-level documentation.', category: 'Code Intelligence' },
    { id: 'docflowai.suggestCodeImprovements', title: 'Suggest Code Improvements', description: 'Find potential code improvements.', category: 'Code Intelligence' },
    { id: 'docflowai.detectTechnologyStack', title: 'Technology Stack', description: 'Detect technologies used in the project.', category: 'Project Analysis' },
    { id: 'docflowai.discoverAPIs', title: 'API Discovery', description: 'Discover APIs in the project.', category: 'Project Analysis' },
    { id: 'docflowai.analyzeDependencies', title: 'Dependency Analysis', description: 'Analyze project dependencies.', category: 'Project Analysis' },
    { id: 'docflowai.analyzeCodeQuality', title: 'Code Quality', description: 'Analyze project code quality.', category: 'Project Analysis' },
    { id: 'docflowai.analyzeChangeImpact', title: 'Change Impact', description: 'Analyze the impact of code changes.', category: 'Project Analysis' },
    { id: 'docflowai.generateDocumentationBundle', title: 'Complete Documentation Bundle', description: 'Generate a complete documentation package.', category: 'Project Tools' },
    { id: 'docflowai.refreshArchitecture', title: 'Refresh Architecture', description: 'Refresh the project architecture.', category: 'Project Tools' },
    { id: 'docflowai.viewActivityLog', title: 'Activity Log', description: 'View recent DocFlowAI activity.', category: 'Project Tools' },
    { id: 'docflowai.clearActivityLog', title: 'Clear Activity Log', description: 'Clear the activity history.', category: 'Project Tools' },
    { id: 'docflowai.configureAIProvider', title: 'Configure AI Provider', description: 'Configure Ollama, Groq or Gemini.', category: 'AI Settings' },
    { id: 'docflowai.testAIConnection', title: 'Test AI Connection', description: 'Test the currently selected AI provider.', category: 'AI Settings' },
    { id: 'docflowai.removeAIAPIKey', title: 'Remove Cloud API Key', description: 'Remove a saved Groq or Gemini key.', category: 'AI Settings' }
];

const DEFAULT_MODELS: Record<AIProviderId, string> = {
    ollama: 'llama3.2',
    groq: 'openai/gpt-oss-20b',
    gemini: 'gemini-3.8-flash'
};

export class DocFlowAIDashboardProvider
    implements vscode.WebviewViewProvider {

    public static readonly viewType = 'docflowai.dashboard';

    private readonly discoveredModels =
        new Map<AIProviderId, string[]>();

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        const webview = webviewView.webview;

        webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webview.html = this.getHtml(webview);

        webview.onDidReceiveMessage(async message => {
            try {
                await this.handleMessage(webview, message);
            } catch (error) {
                const reason = error instanceof Error
                    ? error.message
                    : String(error);

                await webview.postMessage({
                    type: 'operationResult',
                    success: false,
                    message: reason
                });
            }
        });
    }

    private async handleMessage(
        webview: vscode.Webview,
        message: any
    ): Promise<void> {
        if (!message || typeof message.type !== 'string') {
            return;
        }

        switch (message.type) {
            case 'getState':
                await this.sendState(webview);
                return;

            case 'runCommand':
                await this.runCommand(message.commandId);
                return;

            case 'setProvider':
                await this.setProvider(webview, message.provider);
                return;

            case 'discoverModels':
                await this.discoverModels(webview, message.provider);
                return;

            case 'setModel':
                await this.setModel(
                    webview,
                    message.provider,
                    message.model
                );
                return;

            case 'saveApiKey':
                await this.saveApiKey(
                    webview,
                    message.provider,
                    message.apiKey
                );
                return;

            case 'removeApiKey':
                await this.removeApiKey(webview, message.provider);
                return;

            case 'setOllamaUrl':
                await this.setOllamaUrl(webview, message.url);
                return;

            case 'testConnection':
                await this.testConnection(webview, message.provider);
                return;
        }
    }

    private getConfig() {
        return vscode.workspace.getConfiguration('docflowai.ai');
    }

    private isProvider(value: unknown): value is AIProviderId {
        return typeof value === 'string' &&
            PROVIDERS.includes(value as AIProviderId);
    }

    private async sendState(
        webview: vscode.Webview
    ): Promise<void> {
        const config = this.getConfig();

        const provider = config.get<AIProviderId>(
            'provider',
            'ollama'
        );

        const [groqKey, geminiKey] = await Promise.all([
            hasProviderAPIKey('groq'),
            hasProviderAPIKey('gemini')
        ]);

        await webview.postMessage({
            type: 'state',
            state: {
                provider,
                models: {
                    ollama: config.get<string>(
                        'ollama.model',
                        DEFAULT_MODELS.ollama
                    ),
                    groq: config.get<string>(
                        'groq.model',
                        DEFAULT_MODELS.groq
                    ),
                    gemini: config.get<string>(
                        'gemini.model',
                        DEFAULT_MODELS.gemini
                    )
                },
                ollamaUrl: config.get<string>(
                    'ollama.url',
                    'http://localhost:11434'
                ),
                keys: {
                    groq: groqKey,
                    gemini: geminiKey
                }
            }
        });
    }

    private async runCommand(commandId: unknown): Promise<void> {
        if (
            typeof commandId !== 'string' ||
            !COMMANDS.some(command => command.id === commandId)
        ) {
            return;
        }

        await vscode.commands.executeCommand(commandId);
    }

    private async setProvider(
        webview: vscode.Webview,
        value: unknown
    ): Promise<void> {
        if (!this.isProvider(value)) {
            throw new Error('Invalid AI provider.');
        }

        if (value !== 'ollama') {
            const accepted = await vscode.window.showWarningMessage(
                `DocFlowAI will send prompts and relevant project context ` +
                `to ${value === 'groq' ? 'Groq' : 'Google Gemini'} when you ` +
                `use AI features. Continue?`,
                { modal: true },
                'Continue'
            );

            if (accepted !== 'Continue') {
                await this.sendState(webview);
                return;
            }
        }

        await this.getConfig().update(
            'provider',
            value,
            vscode.ConfigurationTarget.Global
        );

        await this.sendState(webview);

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `${this.providerName(value)} is now the active provider.`
        });
    }

    private async discoverModels(
        webview: vscode.Webview,
        value: unknown
    ): Promise<void> {
        if (!this.isProvider(value)) {
            throw new Error('Invalid AI provider.');
        }

        let models: string[];

        switch (value) {
            case 'ollama':
                models = (await discoverOllamaModels())
                    .map(model => model.name);
                break;

            case 'groq':
                models = await discoverGroqModels();
                break;

            case 'gemini':
                models = await discoverGeminiModels();
                break;
        }

        this.discoveredModels.set(value, models);

        await webview.postMessage({
            type: 'models',
            provider: value,
            models
        });

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `Found ${models.length} ${this.providerName(value)} model(s).`
        });
    }

    private async setModel(
        webview: vscode.Webview,
        value: unknown,
        modelValue: unknown
    ): Promise<void> {
        if (!this.isProvider(value)) {
            throw new Error('Invalid AI provider.');
        }

        if (
            typeof modelValue !== 'string' ||
            !modelValue.trim()
        ) {
            throw new Error('Select a valid model.');
        }

        const models = this.discoveredModels.get(value);

        if (!models || !models.includes(modelValue)) {
            throw new Error(
                'Discover available models before selecting a model.'
            );
        }

        await this.getConfig().update(
            `${value}.model`,
            modelValue,
            vscode.ConfigurationTarget.Global
        );

        await this.sendState(webview);

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `Model updated to ${modelValue}.`
        });
    }

    private async saveApiKey(
        webview: vscode.Webview,
        value: unknown,
        keyValue: unknown
    ): Promise<void> {
        if (value !== 'groq' && value !== 'gemini') {
            throw new Error('API keys are only used for Groq and Gemini.');
        }

        if (
            typeof keyValue !== 'string' ||
            !keyValue.trim()
        ) {
            throw new Error('Enter an API key first.');
        }

        await saveProviderAPIKey(value, keyValue);

        await this.sendState(webview);

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `${this.providerName(value)} API key saved securely.`
        });
    }

    private async removeApiKey(
        webview: vscode.Webview,
        value: unknown
    ): Promise<void> {
        if (value !== 'groq' && value !== 'gemini') {
            throw new Error('Invalid cloud provider.');
        }

        const accepted = await vscode.window.showWarningMessage(
            `Remove the saved ${this.providerName(value)} API key?`,
            { modal: true },
            'Remove key'
        );

        if (accepted !== 'Remove key') {
            return;
        }

        await deleteProviderAPIKey(value);

        await this.sendState(webview);

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `${this.providerName(value)} API key removed.`
        });
    }

    private async setOllamaUrl(
        webview: vscode.Webview,
        value: unknown
    ): Promise<void> {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error('Enter an Ollama server URL.');
        }

        let parsed: URL;

        try {
            parsed = new URL(value.trim());
        } catch {
            throw new Error('Enter a valid server URL.');
        }

        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            throw new Error('The server URL must use HTTP or HTTPS.');
        }

        await this.getConfig().update(
            'ollama.url',
            value.trim().replace(/\/+$/, ''),
            vscode.ConfigurationTarget.Global
        );

        this.discoveredModels.delete('ollama');

        await this.sendState(webview);

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: 'Ollama server URL updated.'
        });
    }

    private async testConnection(
        webview: vscode.Webview,
        value: unknown
    ): Promise<void> {
        if (!this.isProvider(value)) {
            throw new Error('Invalid AI provider.');
        }

        const prompt =
            'Reply with exactly this text and nothing else: DOCFLOWAI_CONNECTION_OK';

        let response: string;

        switch (value) {
            case 'ollama':
                response = await generateWithOllama(prompt);
                break;

            case 'groq':
                response = await generateWithGroq(prompt);
                break;

            case 'gemini':
                response = await generateWithGemini(prompt);
                break;
        }

        if (!response.trim()) {
            throw new Error('The provider returned an empty response.');
        }

        await webview.postMessage({
            type: 'operationResult',
            success: true,
            message: `${this.providerName(value)} connection successful.`
        });
    }

    private providerName(provider: AIProviderId): string {
        switch (provider) {
            case 'ollama': return 'Ollama';
            case 'groq': return 'Groq';
            case 'gemini': return 'Gemini';
        }
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();

        const groupedCommands =
            new Map<string, DashboardCommand[]>();

        for (const command of COMMANDS) {
            const group =
                groupedCommands.get(command.category) ?? [];

            group.push(command);
            groupedCommands.set(command.category, group);
        }

        const sections = Array.from(groupedCommands.entries())
            .map(([category, commands]) => `
                <section class="section">
                    <h3>${escapeHtml(category)}</h3>
                    <div class="command-grid">
                        ${commands.map(command => `
                            <button class="command-card"
                                data-command="${escapeHtml(command.id)}">
                                <strong>${escapeHtml(command.title)}</strong>
                                <span>${escapeHtml(command.description)}</span>
                            </button>
                        `).join('')}
                    </div>
                </section>
            `).join('');

        return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>DocFlowAI</title>
<style>
    * { box-sizing: border-box; }

    body {
        margin: 0;
        padding: 15px;
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        font-size: 12px;
    }

    button, input, select { font: inherit; }

    button {
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: 0;
        border-radius: 4px;
        padding: 8px 10px;
        cursor: pointer;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }

    button:disabled {
        opacity: .5;
        cursor: not-allowed;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
    }

    .brand-icon {
        width: 35px;
        height: 35px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        color: #63d9ff;
        background: #172d46;
        font-weight: 800;
        font-size: 19px;
    }

    h1 { font-size: 16px; margin: 0; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 10px; margin-top: 3px; }

    .nav {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-bottom: 18px;
    }

    .nav button {
        color: var(--vscode-foreground);
        background: transparent;
        border: 1px solid var(--vscode-panel-border);
        text-align: left;
    }

    .nav button.active {
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border-color: var(--vscode-button-background);
    }

    .page { display: none; }
    .page.active { display: block; }

    h2 { font-size: 15px; margin: 0 0 6px; }
    h3 {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .6px;
        margin: 20px 0 9px;
    }

    .muted {
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
    }

    .panel {
        padding: 13px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 7px;
        background: var(--vscode-editor-background);
        margin: 12px 0;
    }

    .field { margin: 13px 0; }
    .field label {
        display: block;
        font-weight: 600;
        margin-bottom: 6px;
    }

    input, select {
        width: 100%;
        padding: 8px;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        outline-color: var(--vscode-focusBorder);
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
    }

    .secondary {
        color: var(--vscode-foreground);
        background: var(--vscode-button-secondaryBackground);
    }

    .danger {
        color: var(--vscode-errorForeground);
        background: transparent;
        border: 1px solid var(--vscode-errorForeground);
    }

    .provider-status {
        display: inline-block;
        padding: 4px 7px;
        border-radius: 4px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        font-size: 10px;
    }

    .status {
        display: none;
        padding: 9px;
        border-radius: 5px;
        margin: 12px 0;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }

    .status.visible { display: block; }
    .status.success { background: var(--vscode-testing-iconPassed); color: white; }
    .status.error { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-foreground); }

    .command-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 7px;
    }

    .command-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
        width: 100%;
        padding: 11px;
        text-align: left;
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
    }

    .command-card:hover {
        border-color: var(--vscode-focusBorder);
        background: var(--vscode-list-hoverBackground);
    }

    .command-card strong { font-size: 12px; }
    .command-card span {
        color: var(--vscode-descriptionForeground);
        font-size: 10px;
        line-height: 1.4;
    }

    .search { margin: 12px 0; }
    .small { font-size: 10px; }
    .hidden { display: none !important; }

    footer {
        margin-top: 22px;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        font-size: 10px;
    }
</style>
</head>
<body>
<header class="brand">
    <div class="brand-icon">D</div>
    <div>
        <h1>DocFlowAI</h1>
        <div class="subtitle">AI-powered documentation workspace</div>
    </div>
</header>

<nav class="nav">
    <button class="active" data-page="overview">Overview</button>
    <button data-page="providers">AI Providers</button>
    <button data-page="tools">Tools</button>
    <button data-page="activity">Activity</button>
</nav>

<div id="status" class="status" role="status"></div>

<main>
    <section class="page active" id="page-overview">
        <h2>Welcome to DocFlowAI</h2>
        <p class="muted">
            Your workspace for intelligent documentation,
            code analysis and project insights.
        </p>

        <div class="panel">
            <div class="muted small">ACTIVE AI PROVIDER</div>
            <h2 id="overview-provider">Loading...</h2>
            <div class="muted" id="overview-model">Loading model...</div>
            <div class="actions">
                <button data-go="providers">Manage AI provider</button>
                <button class="secondary" data-go="tools">Explore tools</button>
            </div>
        </div>

        <div class="panel">
            <strong>27 available commands</strong>
            <p class="muted">
                Generate documentation, explore architecture,
                analyze dependencies and improve code quality.
            </p>
            <button data-go="tools">Open all tools</button>
        </div>
    </section>

    <section class="page" id="page-providers">
        <h2>AI Providers</h2>
        <p class="muted">
            Configure the AI engine used by DocFlowAI.
        </p>

        <div class="field">
            <label for="provider">Active provider</label>
            <select id="provider">
                <option value="ollama">Ollama — Local AI</option>
                <option value="groq">Groq — Cloud AI</option>
                <option value="gemini">Google Gemini — Cloud AI</option>
            </select>
        </div>

        <div class="panel" id="ollama-settings">
            <strong>Ollama settings</strong>
            <p class="muted small">
                Connect to your local Ollama server.
            </p>

            <div class="field">
                <label for="ollama-url">Server URL</label>
                <input id="ollama-url"
                    type="url"
                    placeholder="http://localhost:11434">
            </div>

            <button id="save-ollama-url">Save server URL</button>
        </div>

        <div class="panel" id="cloud-settings">
            <strong id="cloud-title">Cloud provider settings</strong>
            <p class="muted small">
                Your API key is stored securely using VS Code SecretStorage.
                The saved key is never displayed or sent back to this interface.
            </p>

            <div class="field">
                <label for="api-key">API key</label>
                <input id="api-key"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Enter a new or replacement API key">
            </div>

            <div class="actions">
                <button id="save-key">Save / Update key</button>
                <button id="remove-key" class="danger">Remove key</button>
            </div>

            <p class="muted small" id="key-status">Checking saved key...</p>
        </div>

        <div class="panel">
            <strong>Model configuration</strong>
            <p class="muted small">
                Discover available models, then select the model
                DocFlowAI should use.
            </p>

            <div class="field">
                <label for="model">Selected model</label>
                <select id="model">
                    <option value="">Discover models first</option>
                </select>
            </div>

            <div class="actions">
                <button id="discover-models">Discover models</button>
                <button id="save-model" class="secondary">Save model</button>
            </div>
        </div>

        <div class="panel">
            <strong>Connection test</strong>
            <p class="muted small">
                Send a small test prompt to the selected provider.
            </p>
            <button id="test-connection">Test connection</button>
        </div>

        <p class="muted small">
            Cloud providers receive prompts and relevant project context
            when you use their AI features. Only use providers you trust.
        </p>
    </section>

    <section class="page" id="page-tools">
        <h2>All tools</h2>
        <p class="muted">
            Browse and launch all DocFlowAI commands.
        </p>

        <input id="tool-search"
            class="search"
            type="search"
            placeholder="Search tools..."
            aria-label="Search tools">

        <main id="sections">${sections}</main>
        <p id="empty-tools" class="muted hidden">
            No matching tools found.
        </p>
    </section>

    <section class="page" id="page-activity">
        <h2>Activity</h2>
        <p class="muted">
            Open the existing DocFlowAI activity history.
        </p>
        <div class="panel">
            <strong>Activity log</strong>
            <p class="muted">
                View recent documentation and analysis operations.
            </p>
            <button id="open-activity">Open activity log</button>
        </div>
        <div class="panel">
            <strong>Clear activity history</strong>
            <p class="muted">
                Remove the recorded DocFlowAI activity.
            </p>
            <button id="clear-activity" class="danger">
                Clear activity log
            </button>
        </div>
    </section>
</main>

<footer>
    DocFlowAI · AI-powered continuous documentation
</footer>

<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let currentState = null;
    let discoveredModels = {
        ollama: [],
        groq: [],
        gemini: []
    };

    const $ = id => document.getElementById(id);

    function post(type, data = {}) {
        vscode.postMessage({ type, ...data });
    }

    function showStatus(message, success = true) {
        const element = $('status');
        element.textContent = message;
        element.className =
            'status visible ' + (success ? 'success' : 'error');
    }

    function providerName(provider) {
        return {
            ollama: 'Ollama',
            groq: 'Groq',
            gemini: 'Google Gemini'
        }[provider] || provider;
    }

    function updateProviderUI() {
        if (!currentState) return;

        const provider = $('provider').value;
        const isOllama = provider === 'ollama';

        $('ollama-settings').classList.toggle(
            'hidden', !isOllama
        );

        $('cloud-settings').classList.toggle(
            'hidden', isOllama
        );

        $('cloud-title').textContent =
            providerName(provider) + ' API key';

        if (isOllama) {
            $('key-status').textContent = '';
        } else {
            const saved = currentState.keys[provider];

            $('key-status').textContent = saved
                ? 'A key is saved securely.'
                : 'No API key is configured yet.';
        }

        $('model').value = currentState.models[provider] || '';

        $('overview-provider').textContent =
            providerName(currentState.provider);

        $('overview-model').textContent =
            currentState.models[currentState.provider] || '';
    }

    function renderModels(provider, models) {
        discoveredModels[provider] = models;

        const select = $('model');
        const selected = currentState?.models?.[provider] || '';

        select.replaceChildren();

        if (!models.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models found';
            select.appendChild(option);
            return;
        }

        for (const model of models) {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            select.appendChild(option);
        }

        if (models.includes(selected)) {
            select.value = selected;
        }
    }

    document.querySelectorAll('.nav button').forEach(button => {
        button.addEventListener('click', () => {
            const page = button.dataset.page;

            document.querySelectorAll('.nav button')
                .forEach(item => item.classList.toggle(
                    'active', item === button
                ));

            document.querySelectorAll('.page')
                .forEach(item => item.classList.toggle(
                    'active', item.id === 'page-' + page
                ));

            if (page === 'providers') {
                updateProviderUI();
            }
        });
    });

    document.querySelectorAll('[data-go]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.go;
            document.querySelector(
                '.nav button[data-page="' + target + '"]'
            ).click();
        });
    });

    $('provider').addEventListener('change', () => {
        updateProviderUI();
        post('setProvider', {
            provider: $('provider').value
        });
    });

    $('discover-models').addEventListener('click', () => {
        post('discoverModels', {
            provider: $('provider').value
        });
    });

    $('save-model').addEventListener('click', () => {
        post('setModel', {
            provider: $('provider').value,
            model: $('model').value
        });
    });

    $('save-key').addEventListener('click', () => {
        const key = $('api-key').value;

        if (!key.trim()) {
            showStatus('Enter an API key first.', false);
            return;
        }

        post('saveApiKey', {
            provider: $('provider').value,
            apiKey: key
        });

        $('api-key').value = '';
    });

    $('remove-key').addEventListener('click', () => {
        post('removeApiKey', {
            provider: $('provider').value
        });
    });

    $('save-ollama-url').addEventListener('click', () => {
        post('setOllamaUrl', {
            url: $('ollama-url').value
        });
    });

    $('test-connection').addEventListener('click', () => {
        post('testConnection', {
            provider: $('provider').value
        });
    });

    $('open-activity').addEventListener('click', () => {
        post('runCommand', {
            commandId: 'docflowai.viewActivityLog'
        });
    });

    $('clear-activity').addEventListener('click', () => {
        post('runCommand', {
            commandId: 'docflowai.clearActivityLog'
        });
    });

    $('tool-search').addEventListener('input', () => {
        const query = $('tool-search').value.toLowerCase().trim();
        const cards = [...document.querySelectorAll('.command-card')];

        cards.forEach(card => {
            card.hidden = !card.textContent.toLowerCase().includes(query);
        });

        document.querySelectorAll('.section').forEach(section => {
            section.hidden = ![
                ...section.querySelectorAll('.command-card')
            ].some(card => !card.hidden);
        });

        $('empty-tools').classList.toggle(
            'hidden', cards.some(card => !card.hidden)
        );
    });

    document.querySelectorAll('.command-card').forEach(button => {
        button.addEventListener('click', () => {
            post('runCommand', {
                commandId: button.dataset.command
            });
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;

        if (message.type === 'state') {
            currentState = message.state;

            $('provider').value = currentState.provider;
            $('ollama-url').value = currentState.ollamaUrl;

            updateProviderUI();
        }

        if (message.type === 'models') {
            renderModels(message.provider, message.models);
        }

        if (message.type === 'operationResult') {
            showStatus(message.message, message.success);

            if (message.success) {
                post('getState');
            }
        }
    });

    post('getState');
</script>
</body>
</html>`;
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return entities[character];
    });
}

function getNonce(): string {
    const values =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    return Array.from(
        { length: 32 },
        () => values[Math.floor(Math.random() * values.length)]
    ).join('');
}
