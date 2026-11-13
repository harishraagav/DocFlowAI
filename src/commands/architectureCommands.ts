
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseFullArchitecture } from '../services/architectureAnalyzer';
import { buildEraserDiagram } from '../diagrams/architectureBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeArchitectureArtifacts } from '../utilities/outputWriter';

export function registerArchitectureCommands(
    context: vscode.ExtensionContext
): void {
    const command = vscode.commands.registerCommand(
        'docflowai.generateSystemArchitecture',
        async () => {
            const workspace = vscode.workspace.workspaceFolders?.[0];

            if (!workspace) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a project folder first.'
                );
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'DocFlowAI: Generating System Architecture',
                    cancellable: false
                },
                async progress => {
                    try {
                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const project = await scanWorkspace(workspace.uri);

                        if (!project.tree.trim()) {
                            throw new Error(
                                'The workspace appears to be empty.'
                            );
                        }

                        progress.report({
                            message: 'Analysing project with Ollama...'
                        });

                        const analysis =
                            await analyseFullArchitecture(project);

                        progress.report({
                            message: 'Building Eraser diagram...'
                        });

                        const diagram = buildEraserDiagram(analysis);

                        progress.report({
                            message: 'Rendering architecture to PNG...'
                        });

                        const png = await renderEraserDiagram(diagram);

                        progress.report({
                            message: 'Saving generated documentation...'
                        });

                        const pngUri = await writeArchitectureArtifacts(
                            workspace.uri,
                            analysis,
                            diagram,
                            png
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: System Architecture generated successfully!'
                        );

                        await vscode.commands.executeCommand(
                            'vscode.open',
                            pngUri
                        );
                    } catch (error) {
                        const message = error instanceof Error
                            ? error.message
                            : String(error);

                        console.error(
                            'DocFlowAI Architecture Error:',
                            error
                        );

                        vscode.window.showErrorMessage(
                            `DocFlowAI: ${message}`
                        );
                    }
                }
            );
        }
    );

    context.subscriptions.push(command);
}
