import * as vscode from 'vscode';
import * as path from 'path';

import { scanWorkspace } from '../services/projectScanner';
import { analyseDependencies } from '../services/dependencyAnalyzer';
import { writeDependencyAnalysisArtifact } from '../utilities/outputWriter';

export function registerDependencyCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.analyzeDependencies',
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
                        title: 'DocFlowAI: Analyzing project dependencies',
                        cancellable: false
                    },
                    async progress => {

                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const snapshot = await scanWorkspace(
                            workspaceFolder.uri
                        );

                        progress.report({
                            message: 'Detecting declared dependencies and internal imports...'
                        });

                        const analysis = analyseDependencies(snapshot);

                        analysis.projectName =
                            vscode.workspace.name ||
                            path.basename(workspaceFolder.uri.fsPath);

                        progress.report({
                            message: 'Generating dependency report...'
                        });

                        return writeDependencyAnalysisArtifact(
                            workspaceFolder.uri,
                            analysis
                        );
                    }
                );

                const document =
                    await vscode.workspace.openTextDocument(reportUri);

                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(
                    'DocFlowAI: Dependency Analysis completed.'
                );

            } catch (error) {

                console.error(
                    'DocFlowAI Dependency Analysis error:',
                    error
                );

                vscode.window.showErrorMessage(
                    `Dependency Analysis failed: ${
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