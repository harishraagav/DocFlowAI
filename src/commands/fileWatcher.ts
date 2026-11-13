
import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder, TextDecoder } from 'util';

import { callOllama } from '../services/ollamaClient';

let saveTimeout: NodeJS.Timeout | undefined;

const IGNORED_FILES = new Set([
    '.env',
    '.env.local',
    '.env.production',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'System_Architecture.png',
    'System_Architecture.eraser.json',
    'DocFlow_System_Architecture.md',
    'DocFlowAI_Activity_Log.md'
]);

const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java',
    '.kt', '.go', '.rs', '.cpp', '.c', '.h', '.cs',
    '.php', '.rb', '.swift', '.vue', '.svelte',
    '.html', '.css', '.scss', '.sql', '.json',
    '.yaml', '.yml', '.toml', '.xml', '.md',
    '.sh', '.bat', '.ps1'
]);

function shouldAnalyse(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file') return false;

    const fileName = path.basename(document.fileName);
    const lower = fileName.toLowerCase();

    if (
        IGNORED_FILES.has(fileName) ||
        lower.startsWith('.env') ||
        lower.includes('secret') ||
        lower.includes('credential')
    ) {
        return false;
    }

    return SOURCE_EXTENSIONS.has(
        path.extname(fileName).toLowerCase()
    );
}

async function handleFileSave(
    document: vscode.TextDocument
): Promise<void> {
    const workspace = vscode.workspace.getWorkspaceFolder(
        document.uri
    );

    if (!workspace || !shouldAnalyse(document)) return;

    const fileName = path.basename(document.fileName);

    try {
        const content = document.getText().slice(0, 20_000);

        const prompt = `
You are a software documentation engineer.

Analyse this saved source file.

File: ${fileName}

Explain:
1. Its architectural responsibility.
2. Important functions and classes.
3. Dependencies and interactions.
4. Its role in the overall project.

Do not invent functionality.

SOURCE CODE:
${content}

Write a concise Markdown explanation.
`;

        const summary = await callOllama(prompt);

        const logUri = vscode.Uri.joinPath(
            workspace.uri,
            'DocFlowAI_Activity_Log.md'
        );

        let existingContent = '# DocFlowAI Activity Log\n\n';

        try {
            const bytes = await vscode.workspace.fs.readFile(logUri);
            existingContent = new TextDecoder().decode(bytes);
        } catch {
            // The log will be created on its first update.
        }

        const update = `
## ${fileName}

**Last analysed:** ${new Date().toLocaleString()}

${summary}

---

`;

        await vscode.workspace.fs.writeFile(
            logUri,
            new TextEncoder().encode(existingContent + update)
        );

        console.log(`DocFlowAI: Analysed saved file ${fileName}`);
    } catch (error) {
        console.error('DocFlowAI Save Analysis Error:', error);
    }
}

export function registerFileWatcher(
    context: vscode.ExtensionContext
): void {
    const listener = vscode.workspace.onDidSaveTextDocument(
        document => {
            if (!shouldAnalyse(document)) return;

            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }

            saveTimeout = setTimeout(() => {
                void handleFileSave(document);
            }, 5000);
        }
    );

    context.subscriptions.push({
        dispose: () => {
            listener.dispose();

            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = undefined;
            }
        }
    });
}
