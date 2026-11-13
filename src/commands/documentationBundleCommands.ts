import * as path from 'path';
import * as vscode from 'vscode';

import { scanWorkspace } from '../services/projectScanner';
import { analyseFullArchitecture } from '../services/architectureAnalyzer';
import { analyseComponents } from '../services/componentAnalyzer';
import { analyseDataFlow } from '../services/dataFlowAnalyzer';
import { analyseSequence } from '../services/sequenceAnalyzer';
import { analyseER } from '../services/erAnalyzer';
import { analyseProjectOverview } from '../services/projectOverviewAnalyzer';
import { analyseTechnologyStack } from '../services/technologyStackAnalyzer';
import { analyseApiDiscovery } from '../services/apiDiscoveryAnalyzer';
import { analyseDependencies } from '../services/dependencyAnalyzer';
import { analyseCodeQuality } from '../services/codeQualityAnalyzer';
import { generateReadme } from '../services/readmeGenerator';
import { generateTechnicalDocumentation } from '../services/technicalDocumentationGenerator';
import { generateOnboardingGuide } from '../services/onboardingGuideGenerator';
import { buildEraserDiagram } from '../diagrams/architectureBuilder';
import { buildComponentDiagram } from '../diagrams/componentBuilder';
import { buildDataFlowDiagram } from '../diagrams/dataFlowBuilder';
import { buildSequenceDiagram } from '../diagrams/sequenceBuilder';
import { buildERDiagram } from '../diagrams/erBuilder';
import { ensureEraserRenderer, renderEraserDiagram } from '../diagrams/eraserRenderer';
import {
    writeArchitectureArtifacts,
    writeComponentArtifacts,
    writeDataFlowArtifacts,
    writeSequenceArtifacts,
    writeERArtifacts,
    writeProjectOverviewArtifact,
    writeTechnologyStackArtifact,
    writeApiDiscoveryArtifact,
    writeApiDocumentationArtifact,
    writeDependencyAnalysisArtifact,
    writeCodeQualityArtifact,
    writeReadmeArtifact,
    writeTechnicalDocumentationArtifact,
    writeOnboardingGuideArtifact,
    writeDocumentationBundleArtifact
} from '../utilities/outputWriter';

interface BundleResult {
    name: string;
    outputs: string[];
    status: 'completed' | 'failed' | 'skipped';
    note?: string;
}

export function registerDocumentationBundleCommands(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('docflowai.generateDocumentationBundle', async () => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            vscode.window.showErrorMessage('DocFlowAI: Open a project folder before generating a documentation bundle.');
            return;
        }

        const projectName = vscode.workspace.name || workspace.name || path.basename(workspace.uri.fsPath);
        const results: BundleResult[] = [];
        const add = (name: string, output: string, status: BundleResult['status'], note?: string) => {
            const existing = results.find(item => item.name === name);
            if (existing) {
                existing.outputs.push(output);
                if (status === 'failed') existing.status = 'failed';
                if (note) existing.note = note;
                return;
            }
            results.push({ name, outputs: output ? [output] : [], status, note });
        };

        try {
            const reportUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DocFlowAI: Generating Documentation Bundle', cancellable: false },
                async progress => {
                    progress.report({ message: 'Scanning workspace once for all bundle tasks...' });
                    const snapshot = await scanWorkspace(workspace.uri);
                    if (!snapshot.tree.trim()) throw new Error('No supported project files were found.');

                    const run = async (
                        name: string,
                        outputNames: string[],
                        task: () => Promise<unknown>
                    ): Promise<void> => {
                        try {
                            await task();
                            add(name, outputNames.join(', '), 'completed');
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            add(name, outputNames.join(', '), 'failed', message);
                            console.error(`[DocFlowAI bundle] ${name} failed:`, error);
                        }
                    };

                    progress.report({ message: 'Generating project overview...' });
                    await run('Project Overview', ['Project_Overview.md'], async () => {
                        const analysis = await analyseProjectOverview(snapshot);
                        analysis.projectName = projectName;
                        await writeProjectOverviewArtifact(workspace.uri, analysis);
                    });

                    progress.report({ message: 'Detecting technology stack...' });
                    await run('Technology Stack', ['Technology_Stack.md'], async () => {
                        const analysis = await analyseTechnologyStack(snapshot);
                        analysis.projectName = projectName;
                        await writeTechnologyStackArtifact(workspace.uri, analysis);
                    });

                    progress.report({ message: 'Discovering APIs and writing API references...' });
                    await run('API Documentation', ['API_Discovery.md', 'API_Documentation.md'], async () => {
                        const analysis = await analyseApiDiscovery(snapshot);
                        analysis.projectName = projectName;
                        await writeApiDiscoveryArtifact(workspace.uri, analysis);
                        await writeApiDocumentationArtifact(workspace.uri, analysis);
                    });

                    progress.report({ message: 'Analyzing dependencies...' });
                    await run('Dependency Analysis', ['Dependency_Analysis.md'], async () => {
                        const analysis = analyseDependencies(snapshot);
                        analysis.projectName = projectName;
                        await writeDependencyAnalysisArtifact(workspace.uri, analysis);
                    });

                    progress.report({ message: 'Analyzing code quality...' });
                    await run('Code Quality', ['Code_Quality_Analysis.md'], async () => {
                        const analysis = analyseCodeQuality(snapshot);
                        analysis.projectName = projectName;
                        await writeCodeQualityArtifact(workspace.uri, analysis);
                    });

                    progress.report({ message: 'Generating README without overwriting the existing README...' });
                    await run('README', ['README_DocFlowAI.md'], async () => {
                        const markdown = await generateReadme(snapshot, projectName);
                        await writeReadmeArtifact(workspace.uri, markdown, 'README_DocFlowAI.md');
                    });

                    progress.report({ message: 'Generating technical documentation...' });
                    await run('Technical Documentation', ['Technical_Documentation.md'], async () => {
                        const markdown = await generateTechnicalDocumentation(
                            snapshot,
                            projectName,
                            message => progress.report({ message })
                        );
                        await writeTechnicalDocumentationArtifact(workspace.uri, markdown);
                    });

                    progress.report({ message: 'Generating developer onboarding guide...' });
                    await run('Developer Onboarding Guide', ['ONBOARDING_GUIDE.md'], async () => {
                        const markdown = await generateOnboardingGuide(
                            snapshot,
                            projectName,
                            message => progress.report({ message })
                        );
                        await writeOnboardingGuideArtifact(workspace.uri, markdown);
                    });

                    progress.report({ message: 'Checking local diagram renderer...' });
                    let rendererReady = true;
                    try {
                        await ensureEraserRenderer();
                    } catch (error) {
                        rendererReady = false;
                        const message = error instanceof Error ? error.message : String(error);
                        console.warn('[DocFlowAI bundle] Diagram renderer unavailable:', error);
                        for (const item of [
                            ['System Architecture', 'System_Architecture.png, System_Architecture.eraser.json, DocFlow_System_Architecture.md'],
                            ['Component Diagram', 'Component_Diagram.png, Component_Diagram.eraser.json, DocFlow_Component_Diagram.md'],
                            ['Data Flow Diagram', 'Data_Flow_Diagram.png, Data_Flow_Diagram.eraser.json, DocFlow_Data_Flow_Diagram.md'],
                            ['Sequence Diagram', 'Sequence_Diagram.png, Sequence_Diagram.eraser.json, DocFlow_Sequence_Diagram.md'],
                            ['Database ER Diagram', 'Database_ER_Diagram.png, Database_ER_Diagram.eraser.json, DocFlow_Database_ER_Diagram.md']
                        ]) {
                            add(item[0], item[1], 'skipped', `Diagram renderer unavailable: ${message}`);
                        }
                    }

                    if (rendererReady) {
                        progress.report({ message: 'Refreshing architecture diagram...' });
                        await run('System Architecture', [
                            'System_Architecture.png',
                            'System_Architecture.eraser.json',
                            'DocFlow_System_Architecture.md'
                        ], async () => {
                            const analysis = await analyseFullArchitecture(snapshot);
                            const diagram = buildEraserDiagram(analysis);
                            const png = await renderEraserDiagram(diagram);
                            await writeArchitectureArtifacts(workspace.uri, analysis, diagram, png);
                        });

                        progress.report({ message: 'Generating component diagram...' });
                        await run('Component Diagram', [
                            'Component_Diagram.png', 'Component_Diagram.eraser.json', 'DocFlow_Component_Diagram.md'
                        ], async () => {
                            const analysis = await analyseComponents(snapshot);
                            const diagram = buildComponentDiagram(analysis);
                            const png = await renderEraserDiagram(diagram);
                            await writeComponentArtifacts(workspace.uri, analysis, diagram, png);
                        });

                        progress.report({ message: 'Generating data flow diagram...' });
                        await run('Data Flow Diagram', [
                            'Data_Flow_Diagram.png', 'Data_Flow_Diagram.eraser.json', 'DocFlow_Data_Flow_Diagram.md'
                        ], async () => {
                            const analysis = await analyseDataFlow(snapshot);
                            const diagram = buildDataFlowDiagram(analysis);
                            const png = await renderEraserDiagram(diagram);
                            await writeDataFlowArtifacts(workspace.uri, analysis, diagram, png);
                        });

                        progress.report({ message: 'Generating sequence diagram...' });
                        await run('Sequence Diagram', [
                            'Sequence_Diagram.png', 'Sequence_Diagram.eraser.json', 'DocFlow_Sequence_Diagram.md'
                        ], async () => {
                            const analysis = await analyseSequence(snapshot);
                            const diagram = buildSequenceDiagram(analysis);
                            const png = await renderEraserDiagram(diagram);
                            await writeSequenceArtifacts(workspace.uri, analysis, diagram, png);
                        });

                        progress.report({ message: 'Generating storage and ER diagram...' });
                        await run('Database ER Diagram', [
                            'Database_ER_Diagram.png', 'Database_ER_Diagram.eraser.json', 'DocFlow_Database_ER_Diagram.md'
                        ], async () => {
                            const analysis = await analyseER(snapshot);
                            const diagram = buildERDiagram(analysis);
                            const png = await renderEraserDiagram(diagram);
                            await writeERArtifacts(workspace.uri, analysis, diagram, png);
                        });
                    }

                    const completed = results.filter(item => item.status === 'completed').length;
                    const failed = results.filter(item => item.status === 'failed').length;
                    const skipped = results.filter(item => item.status === 'skipped').length;
                    const lines = [
                        `# DocFlowAI Documentation Bundle — ${projectName}`,
                        '',
                        `**Generated:** ${new Date().toLocaleString()}`,
                        `**Scanned files:** ${snapshot.fileCount}`,
                        `**Scanned source characters:** ${snapshot.totalCharacters}`,
                        '',
                        '## Generation Summary',
                        '',
                        `- Completed tasks: ${completed}`,
                        `- Failed tasks: ${failed}`,
                        `- Skipped tasks: ${skipped}`,
                        '',
                        '## Generated Artifacts',
                        ''
                    ];

                    for (const item of results) {
                        lines.push(
                            `### ${item.name}`,
                            '',
                            `- **Status:** ${item.status}`,
                            item.outputs.length ? `- **Artifacts:** ${item.outputs.map(output => `\`${output}\``).join(', ')}` : '- **Artifacts:** None',
                            ...(item.note ? [`- **Note:** ${item.note}`] : []),
                            ''
                        );
                    }

                    lines.push(
                        '## Scope and Limitations',
                        '',
                        '- The bundle reuses DocFlowAI static analyzers and local Ollama generation.',
                        '- Individual tasks are isolated: a failed task does not prevent the remaining tasks from running.',
                        '- The README output is saved as `README_DocFlowAI.md`; an existing project README is not overwritten.',
                        '- Diagram PNG rendering requires a compatible local Chrome or Edge executable; each diagram task is reported separately if rendering fails.',
                        '- Generated documentation may not represent dynamic runtime behavior or code outside the workspace scan.',
                        '',
                        '---',
                        '',
                        '*Generated by DocFlowAI.*'
                    );

                    return writeDocumentationBundleArtifact(workspace.uri, lines.join('\n'));
                }
            );

            const document = await vscode.workspace.openTextDocument(reportUri);
            await vscode.window.showTextDocument(document, { preview: false });
            const completed = results.filter(item => item.status === 'completed').length;
            const failed = results.filter(item => item.status === 'failed').length;
            const skipped = results.filter(item => item.status === 'skipped').length;
            if (failed === 0 && skipped === 0) {
                vscode.window.showInformationMessage(`DocFlowAI: Documentation bundle generated (${completed} tasks completed).`);
            } else if (failed === 0) {
                vscode.window.showInformationMessage(`DocFlowAI: Bundle generated with ${completed} completed and ${skipped} skipped tasks. See the bundle report for details.`);
            } else {
                vscode.window.showWarningMessage(`DocFlowAI: Bundle generated with ${completed} completed, ${skipped} skipped and ${failed} failed tasks. See the bundle report for details.`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`DocFlowAI: Documentation bundle failed: ${message}`);
        }
    });

    context.subscriptions.push(command);
}
