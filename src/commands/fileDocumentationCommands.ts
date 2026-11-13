import * as vscode from 'vscode';

import { generateFileDocumentation } from '../services/fileDocumentationGenerator';

import { writeCurrentFileDocumentationArtifact } from '../utilities/outputWriter';

export function registerFileDocumentationCommands(
    context: vscode.ExtensionContext
): void {

    const disposable = vscode.commands.registerCommand(
        'docflowai.documentCurrentFile',

        async () => {

            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a source file before generating documentation.'
                );

                return;
            }

            const document = editor.document;

            const workspaceFolder =
                vscode.workspace.getWorkspaceFolder(document.uri);

            if (!workspaceFolder) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: The current file is not inside an open workspace.'
                );

                return;
            }

            if (document.isUntitled) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Please save the current file before documenting it.'
                );

                return;
            }

            try {

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'DocFlowAI: Documenting Current File',
                        cancellable: false
                    },

                    async (progress) => {

                        progress.report({
                            message: 'Reading current editor contents...'
                        });

                        const filePath =
                            vscode.workspace.asRelativePath(
                                document.uri,
                                false
                            );

                        const fileContent = document.getText();

                        const projectName =
                            vscode.workspace.name ||
                            workspaceFolder.name ||
                            'Current Project';

                        progress.report({
                            message: 'Analyzing source code with Ollama...'
                        });

                        const markdown =
                            await generateFileDocumentation(
                                filePath,
                                document.languageId,
                                fileContent,
                                projectName
                            );

                        progress.report({
                            message: 'Saving file documentation...'
                        });

                        const outputUri =
                            await writeCurrentFileDocumentationArtifact(
                                workspaceFolder.uri,
                                filePath,
                                markdown
                            );

                        const outputDocument =
                            await vscode.workspace.openTextDocument(
                                outputUri
                            );

                        await vscode.window.showTextDocument(
                            outputDocument,
                            { preview: false }
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Current file documentation generated successfully.'
                        );
                    }
                );

            } catch (error) {

                const message = error instanceof Error
                    ? error.message
                    : String(error);

                vscode.window.showErrorMessage(
                    `DocFlowAI: File documentation failed: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}