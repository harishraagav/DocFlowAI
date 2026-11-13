import * as path from 'path';
import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from 'util';

export const ACTIVITY_LOG_FILENAME = 'DocFlowAI_Activity_Log.md';

const TRACKED_ROOT_ARTIFACTS = new Set([
    'System_Architecture.png', 'System_Architecture.eraser.json', 'DocFlow_System_Architecture.md',
    'Component_Diagram.png', 'Component_Diagram.eraser.json', 'DocFlow_Component_Diagram.md',
    'Data_Flow_Diagram.png', 'Data_Flow_Diagram.eraser.json', 'DocFlow_Data_Flow_Diagram.md',
    'Sequence_Diagram.png', 'Sequence_Diagram.eraser.json', 'DocFlow_Sequence_Diagram.md',
    'Database_ER_Diagram.png', 'Database_ER_Diagram.eraser.json', 'DocFlow_Database_ER_Diagram.md',
    'Project_Overview.md', 'Technology_Stack.md', 'API_Discovery.md', 'API_Documentation.md',
    'Dependency_Analysis.md', 'Code_Quality_Analysis.md', 'Change_Impact_Analysis.md',
    'README_DocFlowAI.md', 'Technical_Documentation.md', 'ONBOARDING_GUIDE.md',
    ACTIVITY_LOG_FILENAME, 'DocFlowAI_Documentation_Bundle.md'
]);

function isTrackedArtifact(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    const name = path.posix.basename(normalized);
    if (!normalized.includes('/')) {
        return TRACKED_ROOT_ARTIFACTS.has(name) && name !== ACTIVITY_LOG_FILENAME;
    }

    return [
        'DocFlowAI_File_Documentation/',
        'DocFlowAI_Code_Explanations/',
        'DocFlowAI_Code_Dependencies/',
        'DocFlowAI_Function_Documentation/',
        'DocFlowAI_Code_Improvements/'
    ].some(prefix => normalized.startsWith(prefix));
}

let activityWriteQueue: Promise<void> = Promise.resolve();

function enqueueActivityWrite(operation: () => Promise<void>): Promise<void> {
    const next = activityWriteQueue.then(operation, operation);
    activityWriteQueue = next.catch(() => undefined);
    return next;
}

async function appendActivityLogUnlocked(
    workspace: vscode.Uri,
    action: string,
    details = ''
): Promise<void> {
    const uri = vscode.Uri.joinPath(workspace, ACTIVITY_LOG_FILENAME);
    let existing = '';

    try {
        existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
        existing = '# DocFlowAI Activity Log\n\nRecords of generated DocFlowAI artifacts and commands.\n\n';
    }

    const detailText = details.trim() ? ` — ${details.trim()}` : '';
    const entry = `- **${new Date().toISOString()}** — ${action}${detailText}\n`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(existing + entry));
}

export function appendActivityLog(
    workspace: vscode.Uri,
    action: string,
    details = ''
): Promise<void> {
    return enqueueActivityWrite(() => appendActivityLogUnlocked(workspace, action, details));
}

export function registerActivityArtifactWatcher(
    context: vscode.ExtensionContext
): void {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '**/*')
        );
        const pending = new Map<string, NodeJS.Timeout>();

        const record = (uri: vscode.Uri, event: 'created' | 'updated') => {
            const relative = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
            if (!isTrackedArtifact(relative)) return;

            const previous = pending.get(relative);
            if (previous) clearTimeout(previous);

            const timeout = setTimeout(() => {
                pending.delete(relative);
                void appendActivityLog(
                    folder.uri,
                    event === 'created' ? 'Generated artifact' : 'Updated artifact',
                    relative
                ).catch(error => console.warn('DocFlowAI activity log write failed:', error));
            }, 300);

            pending.set(relative, timeout);
        };

        context.subscriptions.push(
            watcher,
            watcher.onDidCreate(uri => record(uri, 'created')),
            watcher.onDidChange(uri => record(uri, 'updated')),
            {
                dispose: () => {
                    for (const timeout of pending.values()) clearTimeout(timeout);
                    pending.clear();
                }
            }
        );
    }
}

export async function openActivityLog(
    workspace: vscode.Uri
): Promise<void> {
    const uri = vscode.Uri.joinPath(workspace, ACTIVITY_LOG_FILENAME);
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        await appendActivityLog(workspace, 'Activity log initialized');
    }

    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
}

export function clearActivityLog(workspace: vscode.Uri): Promise<void> {
    return enqueueActivityWrite(async () => {
        const uri = vscode.Uri.joinPath(workspace, ACTIVITY_LOG_FILENAME);
        const content = '# DocFlowAI Activity Log\n\nLog cleared by the user.\n\n';
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        await appendActivityLogUnlocked(workspace, 'Activity log cleared');
    });
}
