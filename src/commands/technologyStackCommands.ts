
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseTechnologyStack } from '../services/technologyStackAnalyzer';
import { writeTechnologyStackArtifact } from '../utilities/outputWriter';

export function registerTechnologyStackCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.detectTechnologyStack',
        async () => {

            const workspace = vscode.workspace.workspaceFolders?.[0];

            if (!workspace) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a project folder first.'
                );
                return;
            }

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'DocFlowAI: Detecting Technology Stack',
                        cancellable: false
                    },
                    async progress => {

                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const snapshot = await scanWorkspace(workspace.uri);

                        if (!snapshot.tree.trim()) {
                            throw new Error('No supported project files found.');
                        }

                        progress.report({
                            message: 'Identifying technologies with Ollama...'
                        });

                        const analysis =
                            await analyseTechnologyStack(snapshot);

                        progress.report({
                            message: 'Generating technology report...'
                        });

                        const uri = await writeTechnologyStackArtifact(
                            workspace.uri,
                            analysis
                        );

                        const document =
                            await vscode.workspace.openTextDocument(uri);

                        await vscode.window.showTextDocument(document);

                        vscode.window.showInformationMessage(
                            `DocFlowAI: Detected ${analysis.technologies.length} technologies.`
                        );
                    }
                );

            } catch (error) {
                console.error(
                    '[DocFlowAI] Technology Stack command failed:',
                    error
                );

                vscode.window.showErrorMessage(
                    `DocFlowAI: ${
                        error instanceof Error
                            ? error.message
                            : 'Technology detection failed.'
                    }`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
