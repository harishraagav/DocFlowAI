import * as vscode from 'vscode';
import { scanWorkspace } from '../services/projectScanner';
import { analyseFullArchitecture } from '../services/architectureAnalyzer';
import { buildEraserDiagram } from '../diagrams/architectureBuilder';
import { renderEraserDiagram } from '../diagrams/eraserRenderer';
import { writeArchitectureArtifacts } from '../utilities/outputWriter';

export function registerArchitectureRefreshCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.refreshArchitecture', async () => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            vscode.window.showErrorMessage('DocFlowAI: Open a project folder before refreshing architecture.');
            return;
        }

        try {
            const pngUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DocFlowAI: Refreshing Architecture', cancellable: false },
                async progress => {
                    progress.report({ message: 'Rescanning project files...' });
                    const snapshot = await scanWorkspace(workspace.uri);
                    if (!snapshot.tree.trim()) throw new Error('No supported project files were found.');

                    progress.report({ message: 'Reanalyzing system architecture...' });
                    const analysis = await analyseFullArchitecture(snapshot);
                    progress.report({ message: 'Rebuilding architecture diagram...' });
                    const diagram = buildEraserDiagram(analysis);
                    progress.report({ message: 'Rendering updated architecture...' });
                    const png = await renderEraserDiagram(diagram);
                    progress.report({ message: 'Writing refreshed architecture artifacts...' });
                    return writeArchitectureArtifacts(workspace.uri, analysis, diagram, png);
                }
            );

            await vscode.commands.executeCommand('vscode.open', pngUri);
            vscode.window.showInformationMessage('DocFlowAI: Architecture artifacts refreshed from the current workspace.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Architecture refresh failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
