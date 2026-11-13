import * as path from 'path';
import * as vscode from 'vscode';
import { explainCode } from '../services/codeIntelligence';
import { writeCodeExplanationArtifact } from '../utilities/outputWriter';

function lineScopedArtifactPath(filePath: string, startLine: number, endLine: number): string {
    const suffix = `_L${startLine + 1}-${endLine + 1}`;
    const separator = filePath.lastIndexOf('.');
    const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (separator > slash) {
        return `${filePath.slice(0, separator)}${suffix}${filePath.slice(separator)}`;
    }
    return `${filePath}${suffix}`;
}

export function registerCodeExplanationCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DocFlowAI: Open a file and select code to explain.');
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: The current file is outside an open workspace.');
            return;
        }

        const document = editor.document;
        const selected = !editor.selection.isEmpty;
        const code = selected ? document.getText(editor.selection) : document.getText();
        const filePath = vscode.workspace.asRelativePath(document.uri, false);
        const artifactPath = selected
            ? lineScopedArtifactPath(filePath, editor.selection.start.line, editor.selection.end.line)
            : filePath;
        const projectName = vscode.workspace.name || folder.name || path.basename(folder.uri.fsPath);

        try {
            const outputUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DocFlowAI: Explaining Code', cancellable: false },
                async progress => {
                    progress.report({ message: selected ? 'Explaining selected code...' : 'Explaining current file...' });
                    const markdown = await explainCode(projectName, filePath, document.languageId, code, document.getText());
                    progress.report({ message: 'Saving explanation...' });
                    return writeCodeExplanationArtifact(folder.uri, artifactPath, markdown);
                }
            );

            const output = await vscode.workspace.openTextDocument(outputUri);
            await vscode.window.showTextDocument(output, { preview: false });
            vscode.window.showInformationMessage('DocFlowAI: Code explanation generated.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Code explanation failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
