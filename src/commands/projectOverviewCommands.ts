
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseProjectOverview } from '../services/projectOverviewAnalyzer';
import { writeProjectOverviewArtifact } from '../utilities/outputWriter';

export function registerProjectOverviewCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateProjectOverview',
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
                        title: 'DocFlowAI: Generating Project Overview',
                        cancellable: false
                    },
                    async (progress) => {

                        progress.report({
                            message: 'Scanning workspace...'
                        });

                        const snapshot = await scanWorkspace(workspace.uri);

                        if (!snapshot.tree.trim()) {
                            throw new Error(
                                'No supported project files were found.'
                            );
                        }

                        progress.report({
                            message: 'Analyzing project with Ollama...'
                        });

                        const analysis =
                            await analyseProjectOverview(snapshot);

                        progress.report({
                            message: 'Writing Project Overview...'
                        });

                        const reportUri =
                            await writeProjectOverviewArtifact(
                                workspace.uri,
                                analysis
                            );

                        const document =
                            await vscode.workspace.openTextDocument(reportUri);

                        await vscode.window.showTextDocument(document);

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Project Overview generated successfully.'
                        );
                    }
                );

            } catch (error) {
                console.error(
                    '[DocFlowAI] Project Overview command failed:',
                    error
                );

                vscode.window.showErrorMessage(
                    `DocFlowAI: ${
                        error instanceof Error
                            ? error.message
                            : 'Project Overview generation failed.'
                    }`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
