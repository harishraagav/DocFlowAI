
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseApiDiscovery } from '../services/apiDiscoveryAnalyzer';
import { writeApiDocumentationArtifact } from '../utilities/outputWriter';

export function registerApiDocumentationCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateApiDocumentation',
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
                        title: 'DocFlowAI: Generating API Documentation',
                        cancellable: false
                    },
                    async progress => {

                        progress.report({
                            message: 'Scanning project...'
                        });

                        const snapshot = await scanWorkspace(workspace.uri);

                        progress.report({
                            message: 'Discovering and verifying HTTP endpoints...'
                        });

                        const analysis = await analyseApiDiscovery(snapshot);

                        progress.report({
                            message: 'Writing API reference documentation...'
                        });

                        const reportUri =
                            await writeApiDocumentationArtifact(
                                workspace.uri,
                                analysis
                            );

                        const document =
                            await vscode.workspace.openTextDocument(reportUri);

                        await vscode.window.showTextDocument(document);

                        vscode.window.showInformationMessage(
                            `DocFlowAI: API documentation generated. ${analysis.endpoints.length} verified endpoint(s) documented.`
                        );
                    }
                );

            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : String(error);

                vscode.window.showErrorMessage(
                    `DocFlowAI API Documentation failed: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(command);
}
