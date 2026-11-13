
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseComponents } from '../services/componentAnalyzer';
import { buildComponentDiagram } from '../diagrams/componentBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeComponentArtifacts } from '../utilities/outputWriter';

export function registerComponentCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateComponentDiagram',
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
                    title: 'DocFlowAI: Generating Component Diagram',
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
                            message: 'Identifying software components with Ollama...'
                        });

                        const analysis = await analyseComponents(
                            project
                        );

                        progress.report({
                            message: 'Building component diagram...'
                        });

                        const diagram = buildComponentDiagram(
                            analysis
                        );

                        progress.report({
                            message: 'Rendering diagram with Eraser...'
                        });

                        const png = await renderEraserDiagram(
                            diagram
                        );

                        progress.report({
                            message: 'Saving component documentation...'
                        });

                        const pngUri = await writeComponentArtifacts(
                            workspace.uri,
                            analysis,
                            diagram,
                            png
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Component Diagram generated successfully!'
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
                            'DocFlowAI Component Diagram Error:',
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
