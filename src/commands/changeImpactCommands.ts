
import * as vscode from 'vscode';
import * as path from 'path';

import { scanWorkspace } from '../services/projectScanner';
import {
    analyseChangeImpact,
    getImpactFileOptions
} from '../services/changeImpactAnalyzer';
import { writeChangeImpactArtifact } from '../utilities/outputWriter';

export function registerChangeImpactCommands(
    context: vscode.ExtensionContext
): void {
    const command = vscode.commands.registerCommand(
        'docflowai.analyzeChangeImpact',
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
                        title: 'DocFlowAI: Analyzing change impact',
                        cancellable: false
                    },
                    async progress => {
                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const snapshot = await scanWorkspace(
                            workspaceFolder.uri
                        );

                        const options = getImpactFileOptions(snapshot);

                        if (options.length === 0) {
                            throw new Error(
                                'No readable source files were found.'
                            );
                        }

                        const changedFile =
                            await vscode.window.showQuickPick(
                                options,
                                {
                                    title: 'Select the file being changed',
                                    placeHolder: 'Choose a file to analyze its potential impact',
                                    matchOnDescription: true
                                }
                            );

                        if (!changedFile) return undefined;

                        progress.report({
                            message: 'Tracing internal file dependencies...'
                        });

                        const projectName =
                            vscode.workspace.name ||
                            path.basename(workspaceFolder.uri.fsPath);

                        const analysis = analyseChangeImpact(
                            snapshot,
                            changedFile,
                            projectName
                        );

                        progress.report({
                            message: 'Generating impact report...'
                        });

                        return writeChangeImpactArtifact(
                            workspaceFolder.uri,
                            analysis
                        );
                    }
                );

                if (!reportUri) return;

                const document =
                    await vscode.workspace.openTextDocument(reportUri);

                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(
                    'DocFlowAI: Change Impact Analysis completed.'
                );

            } catch (error) {
                console.error(
                    'DocFlowAI Change Impact Analysis error:',
                    error
                );

                vscode.window.showErrorMessage(
                    `Change Impact Analysis failed: ${
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
