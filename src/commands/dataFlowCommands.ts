
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseDataFlow } from '../services/dataFlowAnalyzer';
import { buildDataFlowDiagram } from '../diagrams/dataFlowBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeDataFlowArtifacts } from '../utilities/outputWriter';

export function registerDataFlowCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateDataFlowDiagram',
        async () => {

            const workspace =
                vscode.workspace.workspaceFolders?.[0];

            if (!workspace) {
                vscode.window.showErrorMessage(
                    'DocFlowAI: Open a project folder first.'
                );
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'DocFlowAI: Generating Data Flow Diagram',
                    cancellable: false
                },
                async progress => {

                    try {

                        progress.report({
                            message: 'Scanning project files...'
                        });

                        const project = await scanWorkspace(
                            workspace.uri
                        );

                        if (!project.tree.trim()) {
                            throw new Error(
                                'The workspace appears to be empty.'
                            );
                        }

                        progress.report({
                            message: 'Analyzing data flows with Ollama...'
                        });

                        const analysis = await analyseDataFlow(
                            project
                        );

                        progress.report({
                            message: 'Building Data Flow Diagram...'
                        });

                        const diagram = buildDataFlowDiagram(
                            analysis
                        );

                        progress.report({
                            message: 'Rendering diagram with Eraser...'
                        });

                        const png = await renderEraserDiagram(
                            diagram
                        );

                        progress.report({
                            message: 'Saving Data Flow documentation...'
                        });

                        const pngUri = await writeDataFlowArtifacts(
                            workspace.uri,
                            analysis,
                            diagram,
                            png
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Data Flow Diagram generated successfully!'
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
                            'DocFlowAI Data Flow Diagram Error:',
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
