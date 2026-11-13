
import * as vscode from 'vscode';
import * as path from 'path';

import { scanWorkspace } from '../services/projectScanner';
import { generateReadme } from '../services/readmeGenerator';
import { writeReadmeArtifact } from '../utilities/outputWriter';

export function registerReadmeCommands(
    context: vscode.ExtensionContext
): void {
    const command = vscode.commands.registerCommand(
        'docflowai.generateReadme',
        async () => {
            const workspaceFolder =
                vscode.workspace.workspaceFolders?.[0];

            if (!workspaceFolder) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a project folder first.'
                );
                return;
            }

            try {
                const reportUri = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'DocFlowAI: Generating README',
                        cancellable: false
                    },
                    async progress => {
                        progress.report({
                            message: 'Scanning project structure and source...'
                        });

                        const snapshot = await scanWorkspace(
                            workspaceFolder.uri
                        );

                        const projectName =
                            vscode.workspace.name ||
                            path.basename(workspaceFolder.uri.fsPath);

                        progress.report({
                            message: 'Generating project documentation with Ollama...'
                        });

                        const markdown = await generateReadme(
                            snapshot,
                            projectName
                        );

                        // Preserve an existing README rather than
                        // silently overwriting the user's documentation.
                        let filename = 'README.md';
                        const existingUri = vscode.Uri.joinPath(
                            workspaceFolder.uri,
                            filename
                        );

                        try {
                            await vscode.workspace.fs.stat(existingUri);

                            const choice =
                                await vscode.window.showWarningMessage(
                                    'A README.md already exists. What would you like to do?',
                                    { modal: true },
                                    'Overwrite README.md',
                                    'Save as README_DocFlowAI.md'
                                );

                            if (!choice) return undefined;

                            if (choice === 'Save as README_DocFlowAI.md') {
                                filename = 'README_DocFlowAI.md';
                            }
                        } catch {
                            // README.md does not exist.
                        }

                        progress.report({
                            message: 'Saving generated README...'
                        });

                        return writeReadmeArtifact(
                            workspaceFolder.uri,
                            markdown,
                            filename
                        );
                    }
                );

                if (!reportUri) return;

                const document =
                    await vscode.workspace.openTextDocument(reportUri);

                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(
                    'DocFlowAI: README generation completed.'
                );

            } catch (error) {
                console.error(
                    'DocFlowAI README Generator error:',
                    error
                );

                vscode.window.showErrorMessage(
                    `README generation failed: ${
                        error instanceof Error
                            ? error.message
                            : String(error)
                    }`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
