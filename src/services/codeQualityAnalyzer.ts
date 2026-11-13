import {
    WorkspaceSnapshot,
    CodeQualityAnalysis,
    CodeQualityFinding
} from '../utilities/types';

import { parseWorkspaceSource } from './projectSourceUtils';

export function analyseCodeQuality(
    workspace: WorkspaceSnapshot
): CodeQualityAnalysis {

    const files = parseWorkspaceSource(workspace.source);
    const findings: CodeQualityFinding[] = [];
    const observations: string[] = [];

    function addFinding(
        title: string,
        description: string,
        severity: CodeQualityFinding['severity'],
        category: string,
        file: string,
        line: number,
        evidence: string,
        recommendation: string
    ): void {

        findings.push({
            title,
            description,
            severity,
            category,
            file,
            line,
            evidence: evidence.trim().slice(0, 180),
            recommendation
        });
    }

    for (const file of files) {

        const lines = file.content.split(/\r?\n/);

        if (lines.length > 500) {
            addFinding(
                'Large source file',
                `This file contains ${lines.length} lines, which may make it harder to maintain.`,
                'low',
                'Maintainability',
                file.path,
                1,
                `${lines.length} lines`,
                'Consider separating unrelated responsibilities into smaller modules.'
            );
        }

        lines.forEach((line, index) => {

            const lineNumber = index + 1;
            const trimmed = line.trim();

            if (!trimmed) return;

            // TODO / FIXME markers
            if (/\b(FIXME|BUG|HACK)\b/i.test(line)) {
                addFinding(
                    'Unresolved code marker',
                    'A FIXME, BUG or HACK marker indicates code that may need attention.',
                    'low',
                    'Maintainability',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Review the marker and resolve or document the outstanding issue.'
                );
            } else if (/\bTODO\b/i.test(line)) {
                addFinding(
                    'Pending implementation marker',
                    'A TODO comment indicates planned or unfinished work.',
                    'info',
                    'Maintainability',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Track the task and remove the marker when the work is completed.'
                );
            }

            // Debugging leftovers
            if (/\bdebugger\s*;?/.test(line)) {
                addFinding(
                    'Debugger statement',
                    'A debugger statement can unexpectedly pause execution when developer tools are open.',
                    'medium',
                    'Debugging',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Remove the debugger statement before release.'
                );
            }

            if (
                /\.(log|debug)\s*\(/.test(line) &&
                /\.(ts|tsx|js|jsx)$/.test(file.path)
            ) {
                addFinding(
                    'Console debugging output',
                    'Console logging may expose internal information or clutter production logs.',
                    'low',
                    'Debugging',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Replace temporary logs with a configurable logging mechanism or remove them.'
                );
            }

            if (
                /\bprint\s*\(/.test(line) &&
                file.path.endsWith('.py')
            ) {
                addFinding(
                    'Print statement',
                    'A print statement was detected. It may be intentional, but could be leftover debugging output.',
                    'info',
                    'Debugging',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Use a configured logging framework for application diagnostics where appropriate.'
                );
            }

            // Risky dynamic execution
            if (/\beval\s*\(/.test(line)) {
                addFinding(
                    'Dynamic code evaluation',
                    'The eval function executes dynamically supplied code and can introduce security risks.',
                    'high',
                    'Security',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Avoid eval. Use explicit parsing or a restricted expression evaluator.'
                );
            }

            // Empty JavaScript catch blocks
            if (
                /\.(ts|tsx|js|jsx)$/.test(file.path) &&
                /^\s*}\s*catch(?:\s*\([^)]*\))?\s*{\s*}\s*$/.test(line)
            ) {
                addFinding(
                    'Empty catch block',
                    'An empty catch block silently discards an exception.',
                    'medium',
                    'Error Handling',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Handle the error, log safe diagnostic information, or rethrow it.'
                );
            }

            // Python bare except
            if (
                file.path.endsWith('.py') &&
                /^\s*except\s*:\s*(?:#.*)?$/.test(line)
            ) {
                addFinding(
                    'Bare exception handler',
                    'A bare except catches nearly every exception, including exceptions that should usually propagate.',
                    'medium',
                    'Error Handling',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Catch specific exception types and handle them explicitly.'
                );
            }

            // Hard-coded credential-like assignments
            const secretPattern =
                /\b(password|passwd|api[_-]?key|secret[_-]?key|access[_-]?token)\b\s*[:=]\s*["'][^"']{6,}["']/i;

            if (secretPattern.test(line)) {
                addFinding(
                    'Possible hard-coded credential',
                    'A credential-like value appears to be assigned directly in source code.',
                    'high',
                    'Security',
                    file.path,
                    lineNumber,
                    '[credential value redacted]',
                    'Move credentials to environment variables or a secure secret manager. Rotate exposed credentials if real.'
                );
            }

            // Wildcard CORS
            if (
                /Access-Control-Allow-Origin.*\*/i.test(line) ||
                /cors\s*\(\s*\{\s*origin\s*:\s*["']\*["']/i.test(line)
            ) {
                addFinding(
                    'Wildcard CORS configuration',
                    'A wildcard CORS origin appears to allow requests from any origin.',
                    'medium',
                    'Security',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Restrict allowed origins to the trusted domains that need access.'
                );
            }

            // Potential SQL string concatenation
            if (
                /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(line) &&
                /(\+\s*[A-Za-z_$]|\$\{|\%\s*[A-Za-z])/.test(line)
            ) {
                addFinding(
                    'Potential SQL string construction',
                    'SQL text appears to be combined with dynamic values. This may be unsafe if user input is involved.',
                    'medium',
                    'Database Safety',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Use parameterized queries or the database library’s safe query-binding API.'
                );
            }

            // Very long source lines
            if (line.length > 180) {
                addFinding(
                    'Long source line',
                    `This line contains ${line.length} characters and may be difficult to read or review.`,
                    'info',
                    'Readability',
                    file.path,
                    lineNumber,
                    `${line.slice(0, 100)}...`,
                    'Consider formatting or extracting complex expressions into named variables or functions.'
                );
            }

            // TypeScript explicit any
            if (
                /\.(ts|tsx)$/.test(file.path) &&
                /:\s*any\b/.test(line)
            ) {
                addFinding(
                    'Explicit any type',
                    'The any type bypasses TypeScript type checking for the annotated value.',
                    'low',
                    'Type Safety',
                    file.path,
                    lineNumber,
                    trimmed,
                    'Use a specific type, generic, or unknown with appropriate type narrowing.'
                );
            }
        });
    }

    const severityCounts = {
        high: findings.filter(item => item.severity === 'high').length,
        medium: findings.filter(item => item.severity === 'medium').length,
        low: findings.filter(item => item.severity === 'low').length,
        info: findings.filter(item => item.severity === 'info').length
    };

    if (findings.length === 0) {
        observations.push(
            'No issues matching the current static analysis rules were detected. This does not prove the code is defect-free.'
        );
    }

    if (workspace.fileCount >= 160) {
        observations.push(
            'The workspace scan reached its file limit. Some source files may not have been analyzed.'
        );
    }

    return {
        projectName: 'Workspace Project',
        summary:
            `Analyzed ${files.length} source files. Found ${findings.length} potential issues: ` +
            `${severityCounts.high} high, ${severityCounts.medium} medium, ` +
            `${severityCounts.low} low and ${severityCounts.info} informational.`,
        findings,
        observations,
        filesAnalyzed: files.length
    };
}