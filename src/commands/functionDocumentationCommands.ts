import * as path from 'path';
import * as vscode from 'vscode';
import { documentFunction } from '../services/codeIntelligence';
import { extractFunctionCandidates } from '../services/functionExtractor';
import { writeFunctionDocumentationArtifact } from '../utilities/outputWriter';

export function registerFunctionDocumentationCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.documentFunctions', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('DocFlowAI: Open a source file containing functions or methods.');
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) {
            vscode.window.showErrorMessage('DocFlowAI: The current file is outside an open workspace.');
            return;
        }

        const candidates = extractFunctionCandidates(editor.document.getText(), editor.document.languageId);
        if (candidates.length === 0) {
            vscode.window.showWarningMessage('DocFlowAI: No supported function or method declarations were detected in this file.');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            candidates.map((item, index) => ({
                label: item.name,
                description: `Lines ${item.line}–${item.endLine}`,
                detail: item.source.split(/\r?\n/)[0].trim(),
                index
            })),
            { placeHolder: 'Choose a function or method to document', matchOnDescription: true }
        );
        if (!selected) return;

        const candidate = candidates[selected.index];
        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        const projectName = vscode.workspace.name || folder.name || path.basename(folder.uri.fsPath);

        try {
            const outputUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `DocFlowAI: Documenting ${candidate.name}`, cancellable: false },
                async progress => {
                    progress.report({ message: 'Analyzing function source...' });
                    const markdown = await documentFunction(
                        projectName,
                        filePath,
                        editor.document.languageId,
                        candidate.name,
                        candidate.line,
                        candidate.source
                    );
                    progress.report({ message: 'Saving function documentation...' });
                    return writeFunctionDocumentationArtifact(folder.uri, filePath, candidate.name, markdown);
                }
            );

            const output = await vscode.workspace.openTextDocument(outputUri);
            await vscode.window.showTextDocument(output, { preview: false });
            vscode.window.showInformationMessage(`DocFlowAI: Documentation generated for ${candidate.name}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Function documentation failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
