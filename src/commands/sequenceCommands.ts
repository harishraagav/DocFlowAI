
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseSequence } from '../services/sequenceAnalyzer';
import { buildSequenceDiagram } from '../diagrams/sequenceBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeSequenceArtifacts } from '../utilities/outputWriter';

export function registerSequenceCommands(
    context: vscode.ExtensionContext
): void {

    const command = vscode.commands.registerCommand(
        'docflowai.generateSequenceDiagram',
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
                    title: 'DocFlowAI: Generating Sequence Diagram',
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
                            message: 'Analyzing runtime interactions with Ollama...'
                        });

                        const analysis = await analyseSequence(
                            project
                        );

                        progress.report({
                            message: 'Building ordered sequence diagram...'
                        });

                        const diagram = buildSequenceDiagram(
                            analysis
                        );

                        progress.report({
                            message: 'Rendering diagram with Eraser...'
                        });

                        const png = await renderEraserDiagram(
                            diagram
                        );

                        progress.report({
                            message: 'Saving sequence documentation...'
                        });

                        const pngUri = await writeSequenceArtifacts(
                            workspace.uri,
                            analysis,
                            diagram,
                            png
                        );

                        vscode.window.showInformationMessage(
                            'DocFlowAI: Sequence Diagram generated successfully!'
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
                            'DocFlowAI Sequence Diagram Error:',
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
