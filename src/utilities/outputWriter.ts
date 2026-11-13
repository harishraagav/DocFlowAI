
import * as vscode from 'vscode';
import { TextEncoder } from 'util';
import {
    ArchitectureAnalysis,
    DiagramDocument,
    DataFlowAnalysis,
    SequenceAnalysis,
    ERAnalysis,
    ProjectOverview,
    TechnologyStackAnalysis,
    ApiDiscoveryAnalysis,
    DependencyAnalysis,
    CodeQualityAnalysis,
    ChangeImpactAnalysis
} from './types';
export function createArchitectureMarkdown(
    analysis: ArchitectureAnalysis
): string {
    const timestamp = new Date().toLocaleString();

    let markdown = `# DocFlowAI — Full System Architecture

**Generated:** ${timestamp}

## System Overview

${analysis.overview}

## Visual System Architecture

![Full System Architecture](./System_Architecture.png)

## Architectural Components

`;

    for (const layer of analysis.layers) {
        markdown += `### ${layer.name}\n\n`;
        markdown += '| Component | Technology | Responsibility |\n';
        markdown += '|---|---|---|\n';

        for (const component of layer.components) {
            markdown +=
                `| ${component.name} | ` +
                `${component.technology || 'Unknown'} | ` +
                `${component.description} |\n`;
        }

        markdown += '\n';
    }

    markdown += '## Data Flow\n\n';

    analysis.dataFlow.forEach((step, index) => {
        markdown += `${index + 1}. ${step}\n`;
    });

    markdown += '\n## System Connections\n\n';
    markdown += '| Source | Destination | Relationship |\n';
    markdown += '|---|---|---|\n';

    const componentNames = new Map<string, string>();

    for (const layer of analysis.layers) {
        for (const component of layer.components) {
            componentNames.set(component.id, component.name);
        }
    }

    for (const connection of analysis.connections) {
        markdown +=
            `| ${componentNames.get(connection.from) || connection.from} | ` +
            `${componentNames.get(connection.to) || connection.to} | ` +
            `${connection.label} |\n`;
    }

    markdown += '\n---\n\n*Generated automatically by DocFlowAI.*\n';

    return markdown;
}

export async function writeWorkspaceFile(
    workspace: vscode.Uri,
    filename: string,
    content: Uint8Array
): Promise<vscode.Uri> {
    const uri = vscode.Uri.joinPath(workspace, filename);

    await vscode.workspace.fs.writeFile(uri, content);

    return uri;
}

export async function writeArchitectureArtifacts(
    workspace: vscode.Uri,
    analysis: ArchitectureAnalysis,
    diagram: any,
    png: Buffer
): Promise<vscode.Uri> {
    const encoder = new TextEncoder();

    const pngUri = await writeWorkspaceFile(
        workspace,
        'System_Architecture.png',
        png
    );

    await writeWorkspaceFile(
        workspace,
        'System_Architecture.eraser.json',
        encoder.encode(JSON.stringify(diagram, null, 2))
    );

    await writeWorkspaceFile(
        workspace,
        'DocFlow_System_Architecture.md',
        encoder.encode(createArchitectureMarkdown(analysis))
    );

    return pngUri;
}


export async function writeComponentArtifacts(
    workspace: vscode.Uri,
    analysis: ArchitectureAnalysis,
    diagram: DiagramDocument,
    png: Buffer
): Promise<vscode.Uri> {

    const encoder = new TextEncoder();

    const pngUri = await writeWorkspaceFile(
        workspace,
        'Component_Diagram.png',
        png
    );

    await writeWorkspaceFile(
        workspace,
        'Component_Diagram.eraser.json',
        encoder.encode(
            JSON.stringify(diagram, null, 2)
        )
    );

    let markdown = `# DocFlowAI — Software Component Diagram

**Generated:** ${new Date().toLocaleString()}

## Component Architecture Overview

${analysis.overview}

## Component Diagram

![Software Component Diagram](./Component_Diagram.png)

## Identified Components

`;

    for (const layer of analysis.layers) {

        markdown += `### ${layer.name}\n\n`;

        markdown += '| Component | Technology | Responsibility |\n';
        markdown += '|---|---|---|\n';

        for (const component of layer.components) {
            markdown +=
                `| ${component.name} | ` +
                `${component.technology || 'Unknown'} | ` +
                `${component.description} |\n`;
        }

        markdown += '\n';
    }

    markdown += '## Component Dependencies\n\n';
    markdown += '| Source | Destination | Relationship |\n';
    markdown += '|---|---|---|\n';

    const names = new Map<string, string>();

    for (const layer of analysis.layers) {
        for (const component of layer.components) {
            names.set(component.id, component.name);
        }
    }

    for (const connection of analysis.connections) {
        markdown +=
            `| ${names.get(connection.from) || connection.from} | ` +
            `${names.get(connection.to) || connection.to} | ` +
            `${connection.label} |\n`;
    }

    markdown += '\n## Data Flow\n\n';

    analysis.dataFlow.forEach((step, index) => {
        markdown += `${index + 1}. ${step}\n`;
    });

    markdown +=
        '\n---\n\n*Generated automatically by DocFlowAI.*\n';

    await writeWorkspaceFile(
        workspace,
        'DocFlow_Component_Diagram.md',
        encoder.encode(markdown)
    );

    return pngUri;
}


export async function writeDataFlowArtifacts(
    workspace: vscode.Uri,
    analysis: DataFlowAnalysis,
    diagram: DiagramDocument,
    png: Buffer
): Promise<vscode.Uri> {

    const encoder = new TextEncoder();

    const pngUri = await writeWorkspaceFile(
        workspace,
        'Data_Flow_Diagram.png',
        png
    );

    await writeWorkspaceFile(
        workspace,
        'Data_Flow_Diagram.eraser.json',
        encoder.encode(
            JSON.stringify(diagram, null, 2)
        )
    );

    let markdown = `# DocFlowAI — Data Flow Diagram

**Generated:** ${new Date().toLocaleString()}

## Data Flow Overview

${analysis.overview}

## Visual Data Flow Diagram

![Data Flow Diagram](./Data_Flow_Diagram.png)

## Identified Data Elements

`;

    const typeLabels: Record<string, string> = {
        external: 'External Entity',
        process: 'Process',
        datastore: 'Data Store'
    };

    for (const type of [
        'external',
        'process',
        'datastore'
    ]) {

        const nodes = analysis.nodes.filter(
            node => node.type === type
        );

        if (nodes.length === 0) continue;

        markdown += `### ${typeLabels[type]}s\n\n`;
        markdown += '| Element | Technology | Description |\n';
        markdown += '|---|---|---|\n';

        for (const node of nodes) {
            markdown +=
                `| ${node.name} | ` +
                `${node.technology || 'Unknown'} | ` +
                `${node.description} |\n`;
        }

        markdown += '\n';
    }

    markdown += '## Data Flow Relationships\n\n';
    markdown += '| Source | Destination | Flow | Data |\n';
    markdown += '|---|---|---|---|\n';

    const nodeNames = new Map<string, string>();

    for (const node of analysis.nodes) {
        nodeNames.set(node.id, node.name);
    }

    for (const flow of analysis.flows) {
        markdown +=
            `| ${nodeNames.get(flow.from) || flow.from} | ` +
            `${nodeNames.get(flow.to) || flow.to} | ` +
            `${flow.label} | ` +
            `${flow.data} |\n`;
    }

    markdown +=
        '\n---\n\n*Generated automatically by DocFlowAI.*\n';

    await writeWorkspaceFile(
        workspace,
        'DocFlow_Data_Flow_Diagram.md',
        encoder.encode(markdown)
    );

    return pngUri;
}


export async function writeSequenceArtifacts(
    workspace: vscode.Uri,
    analysis: SequenceAnalysis,
    diagram: DiagramDocument,
    png: Buffer
): Promise<vscode.Uri> {

    const encoder = new TextEncoder();

    const pngUri = await writeWorkspaceFile(
        workspace,
        'Sequence_Diagram.png',
        png
    );

    await writeWorkspaceFile(
        workspace,
        'Sequence_Diagram.eraser.json',
        encoder.encode(
            JSON.stringify(diagram, null, 2)
        )
    );

    const participantNames = new Map<string, string>();

    for (const participant of analysis.participants) {
        participantNames.set(
            participant.id,
            participant.name
        );
    }

    let markdown = `# DocFlowAI — Sequence Diagram

**Generated:** ${new Date().toLocaleString()}

## Interaction Overview

${analysis.overview}

## Sequence Diagram

![Sequence Diagram](./Sequence_Diagram.png)

## Participants

| Participant | Technology | Type |
|---|---|---|
`;

    for (const participant of analysis.participants) {
        markdown +=
            `| ${participant.name} | ` +
            `${participant.technology || 'Unknown'} | ` +
            `${participant.type || 'Component'} |\n`;
    }

    markdown += `
## Ordered Interactions

| Step | Source | Destination | Message | Type |
|---|---|---|---|---|
`;

    analysis.messages.forEach((message, index) => {
        markdown +=
            `| ${index + 1} | ` +
            `${participantNames.get(message.from) || message.from} | ` +
            `${participantNames.get(message.to) || message.to} | ` +
            `${message.label} | ` +
            `${message.type} |\n`;
    });

    markdown +=
        '\n---\n\n*Generated automatically by DocFlowAI.*\n';

    await writeWorkspaceFile(
        workspace,
        'DocFlow_Sequence_Diagram.md',
        encoder.encode(markdown)
    );

    return pngUri;
}



export async function writeERArtifacts(
    workspace: vscode.Uri,
    analysis: ERAnalysis,
    diagram: DiagramDocument,
    png: Buffer
): Promise<vscode.Uri> {

    const encoder = new TextEncoder();

    const markdownCell = (value: unknown): string =>
        String(value ?? '')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const storageTypeLabels: Record<string, string> = {
        'relational-table': 'Relational Tables',
        'vector-collection': 'Vector Collections',
        'document-collection': 'Document Collections',
        'source-dataset': 'Source Datasets',
        'file-store': 'File Storage',
        'unknown': 'Unknown Storage'
    };

    const lines: string[] = [
        '# Database ER & Storage Architecture',
        '',
        '## Project Overview',
        '',
        analysis.overview,
        '',
        '## Detected Database and Storage Technology',
        '',
        analysis.databaseTechnology,
        '',
        '## Storage Entity Inventory',
        ''
    ];

    const storageTypes = [
        'relational-table',
        'vector-collection',
        'document-collection',
        'source-dataset',
        'file-store',
        'unknown'
    ];

    for (const storageType of storageTypes) {
        const entities = analysis.entities.filter(
            entity => entity.storageType === storageType
        );

        if (entities.length === 0) {
            continue;
        }

        lines.push(
            `### ${storageTypeLabels[storageType]}`,
            ''
        );

        for (const entity of entities) {
            lines.push(
                `#### ${entity.name}`,
                '',
                `- **Storage name:** ${entity.tableName}`,
                `- **Description:** ${entity.description}`,
                `- **Storage type:** ${entity.storageType}`,
                ''
            );

            if (entity.columns.length > 0) {
                lines.push(
                    '| Field | Data Type | Role | Constraints |',
                    '|---|---|---|---|'
                );

                for (const column of entity.columns) {
                    const constraints: string[] = [];

                    if (column.isPrimaryKey) constraints.push('PK');
                    if (column.isForeignKey) constraints.push('FK');
                    if (column.isUnique) constraints.push('Unique');
                    if (column.isNullable) constraints.push('Nullable');
                    else constraints.push('Not Null');

                    lines.push(
                        `| ${markdownCell(column.name)} | ` +
                        `${markdownCell(column.dataType)} | ` +
                        `${markdownCell(column.role ?? 'field')} | ` +
                        `${markdownCell(constraints.join(', '))} |`
                    );
                }

                lines.push('');
            }
        }
    }

    lines.push(
        '## Storage Relationships',
        ''
    );

    if (analysis.relationships.length > 0) {
        lines.push(
            '| Source | Destination | Relationship | Kind | Cardinality | Fields | Evidence |',
            '|---|---|---|---|---|---|---|'
        );

        for (const relationship of analysis.relationships) {
            lines.push(
                `| ${markdownCell(relationship.fromEntity)} | ` +
                `${markdownCell(relationship.toEntity)} | ` +
                `${markdownCell(relationship.label)} | ` +
                `${markdownCell(relationship.kind)} | ` +
                `${markdownCell(relationship.type)} | ` +
                `${markdownCell(`${relationship.fromColumn} → ${relationship.toColumn}`)} | ` +
                `${markdownCell(relationship.evidence)} |`
            );
        }
    } else {
        lines.push(
            'No verified relationships were identified from the available project evidence.'
        );
    }

    lines.push(
        '',
        '## Analysis Notes',
        '',
        '- Entities represent detected storage structures, not necessarily SQL tables.',
        '- Relationships are classified using the available source-code evidence.',
        '- PK/FK labels are only used where the analysis identifies those constraints.',
        '- Vector collections, document collections and source datasets are represented separately.',
        '',
        '---',
        '',
        '*Generated by DocFlowAI*'
    );

    const markdown = lines.join('\n');

    // Save diagram image
    const pngUri = await writeWorkspaceFile(
        workspace,
        'Database_ER_Diagram.png',
        new Uint8Array(png)
    );

    // Save Eraser diagram JSON
    await writeWorkspaceFile(
        workspace,
        'Database_ER_Diagram.eraser.json',
        encoder.encode(JSON.stringify(diagram, null, 2))
    );

    // Save documentation
    await writeWorkspaceFile(
        workspace,
        'DocFlow_Database_ER_Diagram.md',
        encoder.encode(markdown)
    );

    return pngUri;
}


export async function writeProjectOverviewArtifact(
    workspace: vscode.Uri,
    analysis: ProjectOverview
): Promise<vscode.Uri> {

    const encoder = new TextEncoder();

    const clean = (value: string): string =>
        value
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const lines: string[] = [
        `# ${analysis.projectName}`,
        '',
        `**Generated:** ${new Date().toLocaleString()}`,
        '',
        '## Project Overview',
        '',
        `**Project Type:** ${analysis.projectType}`,
        '',
        '### Purpose',
        '',
        analysis.purpose,
        '',
        '### Architecture Summary',
        '',
        analysis.architectureSummary,
        '',
        '## Technology Stack',
        ''
    ];

    if (analysis.primaryTechnologies.length > 0) {
        for (const technology of analysis.primaryTechnologies) {
            lines.push(`- ${clean(technology)}`);
        }
    } else {
        lines.push('No primary technologies were identified.');
    }

    lines.push(
        '',
        '## Project Modules',
        ''
    );

    if (analysis.modules.length > 0) {

        lines.push(
            '| Module | Path | Responsibility | Technologies |',
            '|---|---|---|---|'
        );

        for (const module of analysis.modules) {
            lines.push(
                `| ${clean(module.name)} | ` +
                `${clean(module.path)} | ` +
                `${clean(module.responsibility)} | ` +
                `${clean(module.technologies.join(', ') || 'Unknown')} |`
            );
        }

    } else {
        lines.push('No major modules were identified.');
    }

    lines.push(
        '',
        '## Application Entry Points',
        ''
    );

    if (analysis.entryPoints.length > 0) {

        lines.push(
            '| Entry Point | Path | Purpose |',
            '|---|---|---|'
        );

        for (const entry of analysis.entryPoints) {
            lines.push(
                `| ${clean(entry.name)} | ` +
                `${clean(entry.path)} | ` +
                `${clean(entry.purpose)} |`
            );
        }

    } else {
        lines.push(
            'No confirmed application entry points were identified.'
        );
    }

    lines.push(
        '',
        '## Application Execution Flow',
        ''
    );

    if (analysis.executionFlow.length > 0) {
        analysis.executionFlow.forEach((step, index) => {
            lines.push(`${index + 1}. ${clean(step)}`);
        });
    } else {
        lines.push('Execution flow could not be determined.');
    }

    lines.push(
        '',
        '## Important Project Files',
        ''
    );

    if (analysis.keyFiles.length > 0) {
        for (const file of analysis.keyFiles) {
            lines.push(`- \`${file.trim()}\``);
        }
    } else {
        lines.push('No important files were identified.');
    }

    lines.push(
        '',
        '## Architectural Observations',
        ''
    );

    if (analysis.observations.length > 0) {
        for (const observation of analysis.observations) {
            lines.push(`- ${clean(observation)}`);
        }
    } else {
        lines.push('No additional observations.');
    }

    lines.push(
        '',
        '---',
        '',
        '*Generated automatically by DocFlowAI.*'
    );

    const markdown = lines.join('\n');

    return writeWorkspaceFile(
        workspace,
        'Project_Overview.md',
        encoder.encode(markdown)
    );
}


export async function writeTechnologyStackArtifact(
    workspace: vscode.Uri,
    analysis: TechnologyStackAnalysis
): Promise<vscode.Uri> {

    const escapeCell = (value: string): string =>
        value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

    const technologyRows = analysis.technologies.length
        ? analysis.technologies.map(item => `
| ${escapeCell(item.name)} | ${escapeCell(item.category)} | ${escapeCell(item.purpose)} | ${item.confidence.toUpperCase()} |
`).join('')
        : '\n| No technologies identified | - | - | - |\n';

    const evidenceSections = analysis.technologies.map(item => `
### ${item.name}

${item.evidence.length
    ? item.evidence.map(evidence => `- ${evidence}`).join('\n')
    : '- No specific evidence returned.'}
`).join('\n');

    const content = `
# Technology Stack Analysis

**Project:** ${analysis.projectName}

## Summary

${analysis.summary}

## Detected Technologies

| Technology | Category | Purpose | Confidence |
|---|---|---|---|
${technologyRows}

## Evidence

${evidenceSections || 'No technology evidence available.'}

## Observations

${analysis.observations.length
    ? analysis.observations.map(item => `- ${item}`).join('\n')
    : 'No additional observations.'}

---

*Generated by DocFlowAI*
`;

    return writeWorkspaceFile(
        workspace,
        'Technology_Stack.md',
        new TextEncoder().encode(content)
    );
}


export async function writeApiDiscoveryArtifact(
    workspace: vscode.Uri,
    analysis: ApiDiscoveryAnalysis
): Promise<vscode.Uri> {

    const clean = (value: string): string =>
        value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

    const endpointRows = analysis.endpoints.length
        ? analysis.endpoints.map(endpoint => `
| ${clean(endpoint.method)} | ${clean(endpoint.path)} | ${clean(endpoint.kind)} | ${clean(endpoint.handler)} | ${clean(endpoint.file)} |
`).join('')
        : '\n| - | No API endpoints detected | - | - | - |\n';

    const endpointDetails = analysis.endpoints.length
        ? analysis.endpoints.map((endpoint, index) => `
## ${index + 1}. ${endpoint.name}

- **Method:** \`${endpoint.method}\`
- **Path / URL:** \`${endpoint.path}\`
- **Type:** ${endpoint.kind}
- **Handler:** \`${endpoint.handler}\`
- **Source file:** \`${endpoint.file}\`
- **Purpose:** ${endpoint.purpose}
- **Authentication:** ${endpoint.authentication}

### Request Parameters

${endpoint.requestParameters.length
    ? endpoint.requestParameters.map(item => `- ${item}`).join('\n')
    : 'No parameters identified.'}

### Request Body Fields

${endpoint.requestBodyFields.length
    ? endpoint.requestBodyFields.map(item => `- ${item}`).join('\n')
    : 'No request body fields identified.'}

### Response

${endpoint.responseDescription}

### Evidence

${endpoint.evidence.length
    ? endpoint.evidence.map(item => `- ${item}`).join('\n')
    : 'No specific evidence returned.'}
`).join('\n')
        : 'No API endpoints were identified in the supplied project source code.';

    const dependencies = analysis.dependencies.length
        ? analysis.dependencies.map(item => `
- **${item.sourceEndpoint}** → **${item.targetEndpoint}**: ${item.description}
`).join('')
        : 'No internal API dependencies identified.';

    const observations = analysis.observations.length
        ? analysis.observations.map(item => `- ${item}`).join('\n')
        : 'No additional observations.';

    const content = `
# API Discovery Report

**Project:** ${analysis.projectName}

## Summary

${analysis.summary}

## Endpoint Inventory

| Method | Path / URL | Type | Handler | Source File |
|---|---|---|---|---|
${endpointRows}

## Endpoint Details

${endpointDetails}

## Internal API Dependencies

${dependencies}

## Observations

${observations}

---

*Generated by DocFlowAI*
`;

    return writeWorkspaceFile(
        workspace,
        'API_Discovery.md',
        new TextEncoder().encode(content)
    );
}


export async function writeDependencyAnalysisArtifact(
    workspace: vscode.Uri,
    analysis: DependencyAnalysis
): Promise<vscode.Uri> {

    const clean = (value: string): string =>
        String(value ?? '')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const dependencies = analysis.dependencies.length
        ? analysis.dependencies.map(item =>
            `| ${clean(item.name)} | ${clean(item.version)} | ${clean(item.category)} | ${clean(item.ecosystem)} | ${clean(item.sourceFile)} |`
        ).join('\n')
        : '| No declared dependencies detected | - | - | - | - |';

    const internal = analysis.internalDependencies.length
        ? analysis.internalDependencies.map(item =>
            `| ${clean(item.sourceFile)} | ${clean(item.targetModule)} | \`${clean(item.importStatement)}\` |`
        ).join('\n')
        : '| No relative internal imports detected | - | - |';

    const observations = analysis.observations.length
        ? analysis.observations.map(item => `- ${item}`).join('\n')
        : 'No additional observations.';

    const content = `# Dependency Analysis Report

**Project:** ${analysis.projectName}

**Generated:** ${new Date().toLocaleString()}

## Summary

${analysis.summary}

## External Dependencies

| Package | Declared Version | Category | Ecosystem | Manifest |
|---|---|---|---|---|
${dependencies}

## Internal Module Dependencies

| Source File | Imported Module | Import Statement |
|---|---|---|
${internal}

## Observations

${observations}

## Analysis Scope

- Dependencies are extracted from supported project manifests.
- Versions represent declared manifest values, not necessarily installed versions.
- Transitive dependencies are not resolved.
- Internal imports are identified from source-code import statements.

---

*Generated by DocFlowAI*
`;

    return writeWorkspaceFile(
        workspace,
        'Dependency_Analysis.md',
        new TextEncoder().encode(content)
    );
}
export async function writeCodeQualityArtifact(
    workspace: vscode.Uri,
    analysis: CodeQualityAnalysis
): Promise<vscode.Uri> {

    const clean = (value: string): string =>
        String(value ?? '')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const severityOrder = {
        high: 0,
        medium: 1,
        low: 2,
        info: 3
    };

    const sorted = [...analysis.findings].sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    const findings = sorted.length
        ? sorted.map((item, index) => `
### ${index + 1}. ${clean(item.title)}

- **Severity:** ${item.severity.toUpperCase()}
- **Category:** ${clean(item.category)}
- **File:** \`${clean(item.file)}\`
- **Line:** ${item.line}

**Description:** ${clean(item.description)}

**Evidence:** \`${clean(item.evidence)}\`

**Recommendation:** ${clean(item.recommendation)}
`).join('\n')
        : 'No findings matched the current static analysis rules.';

    const observations = analysis.observations.length
        ? analysis.observations.map(item => `- ${item}`).join('\n')
        : 'No additional observations.';

    const counts = {
        high: analysis.findings.filter(x => x.severity === 'high').length,
        medium: analysis.findings.filter(x => x.severity === 'medium').length,
        low: analysis.findings.filter(x => x.severity === 'low').length,
        info: analysis.findings.filter(x => x.severity === 'info').length
    };

    const content = `# Code Quality Analysis Report

**Project:** ${analysis.projectName}

**Generated:** ${new Date().toLocaleString()}

## Summary

${analysis.summary}

## Analysis Statistics

| Metric | Count |
|---|---:|
| Files analyzed | ${analysis.filesAnalyzed} |
| Total findings | ${analysis.findings.length} |
| High severity | ${counts.high} |
| Medium severity | ${counts.medium} |
| Low severity | ${counts.low} |
| Informational | ${counts.info} |

## Findings

${findings}

## Observations

${observations}

## Analysis Scope

This report is based on static pattern checks against the source files included in the workspace scan. Findings are potential issues requiring developer review, not confirmed vulnerabilities or defects.

---

*Generated by DocFlowAI*
`;

    return writeWorkspaceFile(
        workspace,
        'Code_Quality_Analysis.md',
        new TextEncoder().encode(content)
    );
}

export async function writeChangeImpactArtifact(
    workspace: vscode.Uri,
    analysis: ChangeImpactAnalysis
): Promise<vscode.Uri> {
    const clean = (value: string): string =>
        String(value ?? '')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const formatItems = (
        items: ChangeImpactAnalysis['directDependents']
    ): string => {
        if (items.length === 0) {
            return 'No dependent files were detected.';
        }

        return [
            '| File | Dependency Depth | Dependency Chain |',
            '|---|---:|---|',
            ...items.map(item =>
                `| \`${clean(item.file)}\` | ${item.depth} | ${
                    item.dependencyChain.map(clean).join(' → ')
                } |`
            )
        ].join('\n');
    };

    const observations = analysis.observations.length
        ? analysis.observations.map(item => `- ${clean(item)}`).join('\n')
        : 'No additional observations.';

    const content = `# Change Impact Analysis Report

**Project:** ${clean(analysis.projectName)}

**Generated:** ${new Date().toLocaleString()}

## Changed File

\`${clean(analysis.changedFile)}\`

## Impact Summary

${clean(analysis.summary)}

## Directly Affected Files

${formatItems(analysis.directDependents)}

## Transitively Affected Files

${formatItems(analysis.transitiveDependents)}

## Impact Statistics

| Metric | Count |
|---|---:|
| Direct dependents | ${analysis.directDependents.length} |
| Transitive dependents | ${analysis.transitiveDependents.length} |
| Total potentially affected files | ${
        analysis.directDependents.length +
        analysis.transitiveDependents.length
    } |

## Observations

${observations}

## Analysis Scope

- Relationships are identified from statically detected internal imports.
- Impact indicates potential dependency, not guaranteed runtime impact.
- Dynamic imports, unresolved aliases and framework-specific dependencies may not be detected.
- Only files included in the workspace scan are considered.

---

*Generated by DocFlowAI*
`;

    return writeWorkspaceFile(
        workspace,
        'Change_Impact_Analysis.md',
        new TextEncoder().encode(content)
    );
}

export async function writeReadmeArtifact(
    workspace: vscode.Uri,
    markdown: string,
    filename = 'README.md'
): Promise<vscode.Uri> {
    return writeWorkspaceFile(
        workspace,
        filename,
        new TextEncoder().encode(markdown)
    );
}


export async function writeApiDocumentationArtifact(
    workspace: vscode.Uri,
    analysis: ApiDiscoveryAnalysis
): Promise<vscode.Uri> {

    const clean = (value: unknown): string =>
        String(value ?? '')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, ' ')
            .trim();

    const endpoints = analysis.endpoints;

    const serverRoutes = endpoints.filter(
        endpoint => endpoint.kind === 'server-route'
    );

    const clientRequests = endpoints.filter(
        endpoint => endpoint.kind === 'client-request'
    );

    const lines: string[] = [
        '# API Documentation',
        '',
        `**Project:** ${clean(analysis.projectName)}`,
        `**Generated:** ${new Date().toLocaleString()}`,
        '',
        '## 1. Overview',
        '',
        analysis.summary,
        '',
        'This document describes HTTP routes and outgoing HTTP requests',
        'verified by DocFlowAI from the scanned project source.',
        '',
        '## 2. API Inventory',
        '',
        `- Verified server routes: ${serverRoutes.length}`,
        `- Verified outgoing HTTP requests: ${clientRequests.length}`,
        `- Total verified entries: ${endpoints.length}`,
        ''
    ];

    if (endpoints.length === 0) {
        lines.push(
            '## 3. Endpoint Reference',
            '',
            'No HTTP server routes or outgoing HTTP requests could be verified in the scanned source code.',
            '',
            'This does not prove that the project has no APIs. Routes or requests may exist outside the scanned files or may use unsupported registration patterns.',
            ''
        );
    } else {

        lines.push(
            '## 3. Server API Routes',
            ''
        );

        if (serverRoutes.length === 0) {
            lines.push(
                'No verified server-side HTTP routes were detected.',
                ''
            );
        }

        for (const [index, endpoint] of serverRoutes.entries()) {

            lines.push(
                `### 3.${index + 1}. ${clean(endpoint.name)}`,
                '',
                `- **Method:** \`${clean(endpoint.method)}\``,
                `- **Path:** \`${clean(endpoint.path)}\``,
                `- **Handler:** \`${clean(endpoint.handler)}\``,
                `- **Source file:** \`${clean(endpoint.file)}\``,
                `- **Purpose:** ${clean(endpoint.purpose)}`,
                `- **Authentication:** ${clean(endpoint.authentication)}`,
                '',
                '#### Request Parameters',
                ''
            );

            if (endpoint.requestParameters.length > 0) {
                endpoint.requestParameters.forEach(parameter => {
                    lines.push(`- ${clean(parameter)}`);
                });
            } else {
                lines.push('No request parameters identified.');
            }

            lines.push(
                '',
                '#### Request Body',
                ''
            );

            if (endpoint.requestBodyFields.length > 0) {
                endpoint.requestBodyFields.forEach(field => {
                    lines.push(`- ${clean(field)}`);
                });
            } else {
                lines.push('No request body fields identified.');
            }

            lines.push(
                '',
                '#### Response',
                '',
                clean(endpoint.responseDescription),
                '',
                '#### Source Evidence',
                ''
            );

            if (endpoint.evidence.length > 0) {
                endpoint.evidence.forEach(item => {
                    lines.push(`- ${clean(item)}`);
                });
            } else {
                lines.push('No specific evidence details were returned.');
            }

            lines.push('');
        }

        lines.push(
            '## 4. Outgoing HTTP Requests',
            ''
        );

        if (clientRequests.length === 0) {
            lines.push(
                'No verified outgoing HTTP requests were detected.',
                ''
            );
        }

        for (const [index, endpoint] of clientRequests.entries()) {

            lines.push(
                `### 4.${index + 1}. ${clean(endpoint.name)}`,
                '',
                `- **Method:** \`${clean(endpoint.method)}\``,
                `- **URL / Path:** \`${clean(endpoint.path)}\``,
                `- **Source file:** \`${clean(endpoint.file)}\``,
                `- **Purpose:** ${clean(endpoint.purpose)}`,
                `- **Authentication:** ${clean(endpoint.authentication)}`,
                '',
                '#### Request Parameters',
                ''
            );

            if (endpoint.requestParameters.length > 0) {
                endpoint.requestParameters.forEach(item => {
                    lines.push(`- ${clean(item)}`);
                });
            } else {
                lines.push('No request parameters identified.');
            }

            lines.push(
                '',
                '#### Request Body Fields',
                ''
            );

            if (endpoint.requestBodyFields.length > 0) {
                endpoint.requestBodyFields.forEach(item => {
                    lines.push(`- ${clean(item)}`);
                });
            } else {
                lines.push('No request body fields identified.');
            }

            lines.push(
                '',
                '#### Expected Response',
                '',
                clean(endpoint.responseDescription),
                '',
                '#### Source Evidence',
                ''
            );

            if (endpoint.evidence.length > 0) {
                endpoint.evidence.forEach(item => {
                    lines.push(`- ${clean(item)}`);
                });
            } else {
                lines.push('No specific evidence details were returned.');
            }

            lines.push('');
        }
    }

    lines.push(
        '## 5. Endpoint Dependencies',
        ''
    );

    if (analysis.dependencies.length > 0) {
        for (const dependency of analysis.dependencies) {
            lines.push(
                `- **${clean(dependency.sourceEndpoint)}** → **${clean(dependency.targetEndpoint)}**: ${clean(dependency.description)}`
            );
        }
    } else {
        lines.push('No verified internal API dependencies were identified.');
    }

    lines.push(
        '',
        '## 6. Analysis Observations',
        ''
    );

    if (analysis.observations.length > 0) {
        analysis.observations.forEach(item => {
            lines.push(`- ${clean(item)}`);
        });
    } else {
        lines.push('No additional observations.');
    }

    lines.push(
        '',
        '## 7. Documentation Scope',
        '',
        '- Only endpoints verified by the API Discovery analyzer are included.',
        '- Server routes and outgoing client requests are documented separately.',
        '- Missing request, response or authentication details are not assumed.',
        '- Dynamic routes, unsupported frameworks and files outside the workspace scan may not be detected.',
        '- This document describes static source evidence; it does not represent live API testing.',
        '',
        '---',
        '',
        '*Generated automatically by DocFlowAI.*'
    );

    return writeWorkspaceFile(
        workspace,
        'API_Documentation.md',
        new TextEncoder().encode(lines.join('\n'))
    );
}

export async function writeTechnicalDocumentationArtifact(
    workspace: vscode.Uri,
    markdown: string
): Promise<vscode.Uri> {

    return writeWorkspaceFile(
        workspace,
        'Technical_Documentation.md',
        new TextEncoder().encode(markdown)
    );
}

export async function writeOnboardingGuideArtifact(
    workspace: vscode.Uri,
    markdown: string
): Promise<vscode.Uri> {

    return writeWorkspaceFile(
        workspace,
        'ONBOARDING_GUIDE.md',
        new TextEncoder().encode(markdown)
    );
}

export async function writeCurrentFileDocumentationArtifact(
    workspace: vscode.Uri,
    sourceRelativePath: string,
    markdown: string
): Promise<vscode.Uri> {

    const safeFileName = sourceRelativePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/[^a-zA-Z0-9._/-]/g, '_')
        .replace(/\//g, '__')
        .replace(/^\.+/, '')
        .replace(/\.md$/i, '');

    const fileName = `${safeFileName || 'current-file'}.md`;

    const outputDirectory = vscode.Uri.joinPath(
        workspace,
        'DocFlowAI_File_Documentation'
    );

    await vscode.workspace.fs.createDirectory(outputDirectory);

    const outputUri = vscode.Uri.joinPath(
        outputDirectory,
        fileName
    );

    await vscode.workspace.fs.writeFile(
        outputUri,
        new TextEncoder().encode(markdown)
    );

    return outputUri;
}
function safeGeneratedName(value: string): string {
    return value
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\.[^./]+$/, '')
        .replace(/\//g, '__')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'document';
}

async function writeGeneratedFolderArtifact(
    workspace: vscode.Uri,
    folderName: string,
    filename: string,
    markdown: string
): Promise<vscode.Uri> {
    const folder = vscode.Uri.joinPath(workspace, folderName);
    await vscode.workspace.fs.createDirectory(folder);
    const uri = vscode.Uri.joinPath(folder, filename);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(markdown));
    return uri;
}

export async function writeCodeExplanationArtifact(
    workspace: vscode.Uri,
    sourceFile: string,
    markdown: string
): Promise<vscode.Uri> {
    return writeGeneratedFolderArtifact(
        workspace,
        'DocFlowAI_Code_Explanations',
        `${safeGeneratedName(sourceFile)}_explanation.md`,
        markdown
    );
}

export async function writeCodeDependencyArtifact(
    workspace: vscode.Uri,
    sourceFile: string,
    markdown: string
): Promise<vscode.Uri> {
    return writeGeneratedFolderArtifact(
        workspace,
        'DocFlowAI_Code_Dependencies',
        `${safeGeneratedName(sourceFile)}_dependencies.md`,
        markdown
    );
}

export async function writeFunctionDocumentationArtifact(
    workspace: vscode.Uri,
    sourceFile: string,
    functionName: string,
    markdown: string
): Promise<vscode.Uri> {
    return writeGeneratedFolderArtifact(
        workspace,
        'DocFlowAI_Function_Documentation',
        `${safeGeneratedName(sourceFile)}__${safeGeneratedName(functionName)}.md`,
        markdown
    );
}

export async function writeCodeImprovementsArtifact(
    workspace: vscode.Uri,
    sourceFile: string,
    markdown: string
): Promise<vscode.Uri> {
    return writeGeneratedFolderArtifact(
        workspace,
        'DocFlowAI_Code_Improvements',
        `${safeGeneratedName(sourceFile)}_improvements.md`,
        markdown
    );
}

export async function writeDocumentationBundleArtifact(
    workspace: vscode.Uri,
    markdown: string
): Promise<vscode.Uri> {
    return writeWorkspaceFile(
        workspace,
        'DocFlowAI_Documentation_Bundle.md',
        new TextEncoder().encode(markdown)
    );
}
