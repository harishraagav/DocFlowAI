
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseApiDiscovery } from '../services/apiDiscoveryAnalyzer';
import { writeApiDiscoveryArtifact } from '../utilities/outputWriter';

export function registerApiDiscoveryCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.discoverAPIs',
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
                        title: 'DocFlowAI: Discovering APIs',
                        cancellable: false
                    },
                    async progress => {

                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const snapshot = await scanWorkspace(workspace.uri);

                        if (!snapshot.tree.trim()) {
                            throw new Error(
                                'No supported project files found.'
                            );
                        }

                        progress.report({
                            message: 'Analyzing API routes and requests with Ollama...'
                        });

                        const analysis = await analyseApiDiscovery(snapshot);

                        progress.report({
                            message: 'Generating API Discovery report...'
                        });

                        const uri = await writeApiDiscoveryArtifact(
                            workspace.uri,
                            analysis
                        );

                        const document =
                            await vscode.workspace.openTextDocument(uri);

                        await vscode.window.showTextDocument(document);

                        vscode.window.showInformationMessage(
                            `DocFlowAI: API Discovery completed. ${analysis.endpoints.length} endpoints identified.`
                        );
                    }
                );

            } catch (error) {
                console.error(
                    '[DocFlowAI] API Discovery command failed:',
                    error
                );

                vscode.window.showErrorMessage(
                    `DocFlowAI: ${
                        error instanceof Error
                            ? error.message
                            : 'API Discovery failed.'
                    }`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
