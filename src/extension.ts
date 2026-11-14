
import * as vscode from 'vscode';

import { registerERCommands } from './commands/erCommands';
import { registerArchitectureCommands } from './commands/architectureCommands';
import { registerComponentCommands } from './commands/componentCommands';
import { registerDataFlowCommands } from './commands/dataFlowCommands';
import { registerFileWatcher } from './commands/fileWatcher';
import { registerSequenceCommands } from './commands/sequenceCommands';
import { closeEraserRenderer } from './diagrams/eraserRenderer';
import { registerDependencyCommands } from './commands/dependencyCommands';
import { registerCodeQualityCommands } from './commands/codeQualityCommands';
import { registerTechnologyStackCommands } from './commands/technologyStackCommands';
import { registerApiDiscoveryCommands } from './commands/apiDiscoveryCommands';
import { registerProjectOverviewCommands } from './commands/projectOverviewCommands';
import { registerChangeImpactCommands } from './commands/changeImpactCommands';
import { registerReadmeCommands } from './commands/readmeCommands';
import { registerApiDocumentationCommands } from './commands/apiDocumentationCommands';
import { registerTechnicalDocumentationCommands } from './commands/technicalDocumentationCommands';
import { registerOnboardingGuideCommands } from './commands/onboardingGuideCommands';
import { registerFileDocumentationCommands } from './commands/fileDocumentationCommands';
import { registerCodeExplanationCommands } from './commands/codeExplanationCommands';
import { registerCodeDependencyCommands } from './commands/codeDependencyCommands';
import { registerFunctionDocumentationCommands } from './commands/functionDocumentationCommands';
import { registerCodeImprovementCommands } from './commands/codeImprovementCommands';
import { registerDocumentationBundleCommands } from './commands/documentationBundleCommands';
import { registerArchitectureRefreshCommands } from './commands/architectureRefreshCommands';
import { registerActivityLogCommands } from './commands/activityLogCommands';
import { registerAIProviderCommands } from './commands/aiProviderCommands';
import {
    DocFlowAIDashboardProvider
} from './providers/docflowaiDashboardProvider';

import { initializeAIProvider } from './services/aiProvider';

export function activate(context: vscode.ExtensionContext): void {
    initializeAIProvider(context);
        const dashboardProvider = new DocFlowAIDashboardProvider(
        context.extensionUri
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DocFlowAIDashboardProvider.viewType,
            dashboardProvider
        )
    );

    console.log('DocFlowAI is active!');

    registerArchitectureCommands(context);

    registerComponentCommands(context);
    registerApiDocumentationCommands(context);
    registerTechnicalDocumentationCommands(context);
    registerDataFlowCommands(context);
    registerSequenceCommands(context);
    registerChangeImpactCommands(context);
    registerOnboardingGuideCommands(context);
    registerFileDocumentationCommands(context);
    registerReadmeCommands(context);
    registerDependencyCommands(context);
    registerCodeQualityCommands(context);
    registerERCommands(context);
    registerApiDiscoveryCommands(context);
    registerProjectOverviewCommands(context);
    registerTechnologyStackCommands(context);
    registerFileWatcher(context);

    registerCodeExplanationCommands(context);
    registerCodeDependencyCommands(context);
    registerFunctionDocumentationCommands(context);
    registerCodeImprovementCommands(context);
    registerDocumentationBundleCommands(context);
    registerArchitectureRefreshCommands(context);
    registerActivityLogCommands(context);

    registerAIProviderCommands(context);

    vscode.window.showInformationMessage(
        'DocFlowAI is ready. Your project documentation assistant is active.'
    );
}

export async function deactivate(): Promise<void> {
    await closeEraserRenderer();

    console.log('DocFlowAI deactivated.');
}
