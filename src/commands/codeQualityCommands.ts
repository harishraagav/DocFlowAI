import * as vscode from 'vscode';
import * as path from 'path';

import { scanWorkspace } from '../services/projectScanner';
import { analyseCodeQuality } from '../services/codeQualityAnalyzer';
import { writeCodeQualityArtifact } from '../utilities/outputWriter';

export function registerCodeQualityCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.analyzeCodeQuality',
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
                        title: 'DocFlowAI: Analyzing code quality',
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
                            message: 'Checking maintainability, safety and code patterns...'
                        });

                        const analysis = analyseCodeQuality(snapshot);

                        analysis.projectName =
                            vscode.workspace.name ||
                            path.basename(workspaceFolder.uri.fsPath);

                        progress.report({
                            message: 'Generating code quality report...'
                        });

                        return writeCodeQualityArtifact(
                            workspaceFolder.uri,
                            analysis
                        );
                    }
                );

                const document =
                    await vscode.workspace.openTextDocument(reportUri);

                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(
                    'DocFlowAI: Code Quality Analysis completed.'
                );

            } catch (error) {

                console.error(
                    'DocFlowAI Code Quality Analysis error:',
                    error
                );

                vscode.window.showErrorMessage(
                    `Code Quality Analysis failed: ${
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