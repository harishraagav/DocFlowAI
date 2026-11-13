import * as vscode from 'vscode';
import { clearActivityLog, openActivityLog, registerActivityArtifactWatcher } from '../services/activityLogger';

export function registerActivityLogCommands(context: vscode.ExtensionContext): void {
    registerActivityArtifactWatcher(context);

    const view = vscode.commands.registerCommand('docflowai.viewActivityLog', async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: Open a workspace to view its activity log.');
            return;
        }
        try {
            await openActivityLog(folder.uri);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Could not open activity log: ${message}`);
        }
    });

    const clear = vscode.commands.registerCommand('docflowai.clearActivityLog', async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: Open a workspace to clear its activity log.');
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            'Clear the DocFlowAI activity log for this workspace?',
            { modal: true },
            'Clear Log'
        );
        if (choice !== 'Clear Log') return;

        try {
            await clearActivityLog(folder.uri);
            await openActivityLog(folder.uri);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Could not clear activity log: ${message}`);
        }
    });

    context.subscriptions.push(view, clear);
}
