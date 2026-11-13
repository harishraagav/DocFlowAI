import * as path from 'path';
import * as vscode from 'vscode';
import { suggestCodeImprovements } from '../services/codeIntelligence';
import { writeCodeImprovementsArtifact } from '../utilities/outputWriter';

function lineScopedArtifactPath(filePath: string, startLine: number, endLine: number): string {
    const suffix = `_L${startLine + 1}-${endLine + 1}`;
    const separator = filePath.lastIndexOf('.');
    const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (separator > slash) {
        return `${filePath.slice(0, separator)}${suffix}${filePath.slice(separator)}`;
    }
    return `${filePath}${suffix}`;
}

export function registerCodeImprovementCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.suggestCodeImprovements', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DocFlowAI: Open a file or select code to review.');
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: The current file is outside an open workspace.');
            return;
        }

        const selected = !editor.selection.isEmpty;
        const code = selected ? editor.document.getText(editor.selection) : editor.document.getText();
        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        const artifactPath = selected
            ? lineScopedArtifactPath(filePath, editor.selection.start.line, editor.selection.end.line)
            : filePath;
        const projectName = vscode.workspace.name || folder.name || path.basename(folder.uri.fsPath);

        try {
            const outputUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DocFlowAI: Suggesting Code Improvements', cancellable: false },
                async progress => {
                    progress.report({ message: 'Reviewing source evidence...' });
                    const markdown = await suggestCodeImprovements(projectName, filePath, editor.document.languageId, code);
                    progress.report({ message: 'Saving improvement report...' });
                    return writeCodeImprovementsArtifact(folder.uri, artifactPath, markdown);
                }
            );

            const output = await vscode.workspace.openTextDocument(outputUri);
            await vscode.window.showTextDocument(output, { preview: false });
            vscode.window.showInformationMessage('DocFlowAI: Code improvement report generated.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Code improvement analysis failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
