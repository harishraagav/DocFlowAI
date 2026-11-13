import * as path from 'path';
import * as vscode from 'vscode';
import { scanWorkspace } from '../services/projectScanner';
import { analyzeCodeDependencies } from '../services/codeDependencyAnalyzer';
import { writeCodeDependencyArtifact } from '../utilities/outputWriter';

export function registerCodeDependencyCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.findDependencies', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DocFlowAI: Open the source file whose dependencies you want to trace.');
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: The current file is outside an open workspace.');
            return;
        }

        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);

        try {
            const outputUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DocFlowAI: Finding Code Dependencies', cancellable: false },
                async progress => {
                    progress.report({ message: 'Scanning workspace imports...' });
                    const snapshot = await scanWorkspace(folder.uri);
                    progress.report({ message: 'Resolving internal modules and dependency chains...' });
                    const markdown = analyzeCodeDependencies(filePath, editor.document.getText(), snapshot.source);
                    return writeCodeDependencyArtifact(folder.uri, filePath, markdown);
                }
            );

            const output = await vscode.workspace.openTextDocument(outputUri);
            await vscode.window.showTextDocument(output, { preview: false });
            vscode.window.showInformationMessage('DocFlowAI: Code dependency report generated.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Dependency tracing failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
