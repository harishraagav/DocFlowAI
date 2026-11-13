import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';

import { generateOnboardingGuide } from '../services/onboardingGuideGenerator';

import { writeOnboardingGuideArtifact } from '../utilities/outputWriter';

export function registerOnboardingGuideCommands(
    context: vscode.ExtensionContext
): void {

    const disposable = vscode.commands.registerCommand(
        'docflowai.generateOnboardingGuide',

        async () => {

            const workspaceFolder =
                vscode.workspace.workspaceFolders?.[0];

            if (!workspaceFolder) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Please open a project workspace first.'
                );

                return;
            }

            try {

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'DocFlowAI: Generating Developer Onboarding Guide',
                        cancellable: false
                    },

                    async (progress) => {

                        progress.report({
                            message: 'Scanning project workspace...'
                        });

                        const workspace = await scanWorkspace(
                            workspaceFolder.uri
                        );

                        const projectName =
                            vscode.workspace.name ||
                            workspaceFolder.name ||
                            'Current Project';

                        const markdown = await generateOnboardingGuide(
                            workspace,
                            projectName,
                            (message) => {
                                progress.report({ message });
                            }
                        );

                        progress.report({
                            message: 'Saving onboarding guide...'
                        });

                        const outputUri =
                            await writeOnboardingGuideArtifact(
                                workspaceFolder.uri,
                                markdown
                            );

                        const document =
                            await vscode.workspace.openTextDocument(
                                outputUri
                            );

                        await vscode.window.showTextDocument(
                            document,
                            { preview: false }
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Developer Onboarding Guide generated successfully.'
                        );
                    }
                );

            } catch (error) {

                const message = error instanceof Error
                    ? error.message
                    : String(error);

                vscode.window.showErrorMessage(
                    `DocFlowAI: Onboarding Guide generation failed: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}