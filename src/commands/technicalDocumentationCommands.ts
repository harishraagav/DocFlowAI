
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { generateTechnicalDocumentation } from '../services/technicalDocumentationGenerator';
import { writeTechnicalDocumentationArtifact } from '../utilities/outputWriter';

export function registerTechnicalDocumentationCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateTechnicalDocumentation',
        async () => {

            const workspace = vscode.workspace.workspaceFolders?.[0];

            if (!workspace) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a workspace folder first.'
                );
                return;
            }

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'DocFlowAI: Generating Technical Documentation',
                        cancellable: false
                    },
                    async progress => {

                        progress.report({
                            message: 'Scanning project...'
                        });

                        const snapshot = await scanWorkspace(workspace.uri);

                        const projectName =
                            vscode.workspace.name ||
                            workspace.name ||
                            'Current Project';

                        progress.report({
                            message: 'Analyzing project architecture...'
                        });

                        progress.report({
                            message: 'Analyzing modules and technologies...'
                        });

                        progress.report({
                            message: 'Discovering verified APIs...'
                        });

                        progress.report({
                            message: 'Generating technical documentation with Ollama...'
                        });

                        
                        const markdown = await generateTechnicalDocumentation(
                            snapshot,
                            projectName,
                            message => progress.report({ message })
                        );


                        progress.report({
                            message: 'Writing technical documentation...'
                        });

                        const reportUri =
                            await writeTechnicalDocumentationArtifact(
                                workspace.uri,
                                markdown
                            );

                        const document =
                            await vscode.workspace.openTextDocument(reportUri);

                        await vscode.window.showTextDocument(document);

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Technical documentation generated successfully.'
                        );
                    }
                );

            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : String(error);

                vscode.window.showErrorMessage(
                    `DocFlowAI Technical Documentation failed: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
