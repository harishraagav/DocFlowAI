import { WorkspaceSnapshot } from '../utilities/types';

import { analyseProjectOverview } from './projectOverviewAnalyzer';
import { analyseTechnologyStack } from './technologyStackAnalyzer';
import { callOllama } from './ollamaClient';

function cleanMarkdown(response: string): string {
    return response
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}

export async function generateOnboardingGuide(
    project: WorkspaceSnapshot,
    projectName: string,
    onProgress?: (message: string) => void
): Promise<string> {

    onProgress?.('Analyzing project structure...');

    const overview = await analyseProjectOverview(project);

    onProgress?.('Detecting project technologies...');

    const technologyStack = await analyseTechnologyStack(project);

    onProgress?.('Generating onboarding guide with Ollama...');

    const sourceContext = project.source.slice(0, 40000);

    const wasTruncated = project.source.length > 40000;

    const prompt = `
You are a senior software engineer and technical onboarding specialist.

Your task is to create a practical developer onboarding guide
for an existing software project.

PROJECT NAME:
${projectName}

PROJECT OVERVIEW:
${JSON.stringify(overview, null, 2)}

TECHNOLOGY STACK:
${JSON.stringify(technologyStack, null, 2)}

PROJECT FILE TREE:
${project.tree}

SOURCE CONTEXT:
${sourceContext}

SOURCE TRUNCATED:
${wasTruncated}

DOCUMENTATION REQUIREMENTS:

Generate a professional Markdown document.

Use the following sections:

# Developer Onboarding Guide

## 1. Welcome
- Explain what the project does.
- Explain its primary purpose.
- Identify its intended users if supported by evidence.

## 2. Project Overview
- Explain the major capabilities.
- Describe the application type.
- Summarize the architecture.

## 3. Technology Prerequisites
- List the technologies actually detected.
- Explain what each technology is used for.
- Mention required runtimes or tools only when supported by evidence.
- Do not invent minimum versions.

## 4. Repository Structure
- Explain important directories and files.
- Describe their responsibilities.
- Highlight important entry points.

## 5. Architecture and Execution Flow
- Explain how the major modules interact.
- Describe the execution flow step by step.
- Explain how data moves through the application.

## 6. Environment and Configuration
- Identify configuration files and environment variables
  only when they are present in the supplied evidence.
- Explain required configuration.
- Clearly state when configuration requirements are unknown.

## 7. Getting Started
- Provide installation and setup steps only when supported
  by the source files or project documentation.
- Include actual commands only when they can be verified.
- Never invent package installation commands, scripts,
  environment variables, ports, or configuration values.

## 8. Understanding the Codebase
- Identify the most useful files for a new developer to read.
- Explain where important functionality is implemented.
- Describe important internal dependencies.

## 9. Development Workflow
- Explain how a developer can understand and modify the project.
- Describe the existing development workflow when evidence exists.
- Do not invent Git branching rules, code review processes,
  testing procedures, or contribution policies.

## 10. Troubleshooting
- Include only issues supported by project documentation
  or source evidence.
- If no known issues are identified, say so.

## 11. Suggested First Tasks
- Suggest small, safe tasks based on the actual codebase.
- Do not claim that these tasks already exist as issues.

## 12. Important Notes
- Mention limitations, missing documentation,
  and areas requiring further investigation.

## 13. Onboarding Scope
- Explain that this guide was generated through static analysis.
- Mention that dynamic behavior may not be fully represented.

STRICT ACCURACY RULES:

1. Use only the supplied project evidence.
2. Never invent files, folders, dependencies, commands,
   environment variables, APIs, or features.
3. Do not assume that a technology is installed merely
   because it is mentioned in explanatory text.
4. Clearly label uncertain information.
5. If information is unavailable, write:
   "Not identified in the scanned project."
6. If the source context was truncated, do not claim
   that the entire codebase was inspected.
7. Avoid repeating the same information across sections.
8. Write for a new developer who has never seen this project.
9. Keep explanations practical and easy to follow.
10. Return only the completed Markdown document.

Generate the onboarding guide now.
`;

    const response = await callOllama(prompt, false);

    const markdown = cleanMarkdown(response);

    if (!markdown) {
        throw new Error(
            'Ollama returned an empty onboarding guide.'
        );
    }

    return markdown;
}