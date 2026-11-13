
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseER } from '../services/erAnalyzer';
import { buildERDiagram } from '../diagrams/erBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeERArtifacts } from '../utilities/outputWriter';

export function registerERCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateERDiagram',
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
                    title: 'DocFlowAI: Generating Database ER Diagram',
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
                            message: 'Analyzing database entities with Ollama...'
                        });

                        const analysis = await analyseER(project);
                        console.log(
                            '[DocFlowAI] ER Analysis:',
                            JSON.stringify(analysis, null, 2)
                        );
                        progress.report({
                            message: 'Building Database ER Diagram...'
                        });

                        const diagram = buildERDiagram(
                            analysis
                        );

                        progress.report({
                            message: 'Rendering diagram with Eraser...'
                        });

                        const png = await renderEraserDiagram(
                            diagram
                        );

                        progress.report({
                            message: 'Saving database documentation...'
                        });

                        const pngUri = await writeERArtifacts(
                            workspace.uri,
                            analysis,
                            diagram,
                            png
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Database ER Diagram generated successfully!'
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
                            'DocFlowAI Database ER Diagram Error:',
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
