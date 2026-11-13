
import * as path from 'path';
import { WorkspaceSnapshot } from '../utilities/types';

export interface ChangeImpactItem {
    file: string;
    depth: number;
    dependencyChain: string[];
}

export interface ChangeImpactAnalysis {
    projectName: string;
    changedFile: string;
    summary: string;
    directDependents: ChangeImpactItem[];
    transitiveDependents: ChangeImpactItem[];
    observations: string[];
}

interface ScannedFile {
    path: string;
    content: string;
}

function normalizePath(value: string): string {
    return value
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '')
        .toLowerCase();
}

function parseWorkspaceFiles(source: string): ScannedFile[] {
    const parts = source.split(
        /\n\s*={3,}\s*FILE:\s*(.*?)\s*={3,}\s*\n/
    );

    const files: ScannedFile[] = [];

    for (let i = 1; i < parts.length; i += 2) {
        const filePath = parts[i]?.trim();
        const content = parts[i + 1] ?? '';

        if (filePath) {
            files.push({
                path: filePath.replace(/\\/g, '/'),
                content
            });
        }
    }

    return files;
}

function extractImports(file: ScannedFile): string[] {
    const imports = new Set<string>();
    const extension = path.posix.extname(file.path).toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'].includes(extension)) {
        const patterns = [
            /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
            /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
            /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];

        for (const pattern of patterns) {
            for (const match of file.content.matchAll(pattern)) {
                if (match[1]) imports.add(match[1]);
            }
        }
    }

    if (extension === '.py') {
        const fromPattern =
            /^\s*from\s+(\.*[\w.]+)\s+import\s+/gm;

        const importPattern =
            /^\s*import\s+([\w.]+)/gm;

        for (const match of file.content.matchAll(fromPattern)) {
            if (match[1]) imports.add(match[1]);
        }

        for (const match of file.content.matchAll(importPattern)) {
            if (match[1]) imports.add(match[1]);
        }
    }

    return [...imports];
}

function resolveImport(
    importer: string,
    specifier: string,
    knownFiles: Map<string, string>
): string | undefined {
    const normalizedImporter = normalizePath(importer);
    const extension = path.posix.extname(normalizedImporter);

    let baseCandidates: string[] = [];

    if (
        specifier.startsWith('./') ||
        specifier.startsWith('../')
    ) {
        const base = path.posix.normalize(
            path.posix.join(
                path.posix.dirname(normalizedImporter),
                specifier
            )
        );

        baseCandidates = [base];

    } else if (extension === '.py') {
        const relativeMatch = specifier.match(/^(\.*)([\w.]+)$/);

        if (relativeMatch) {
            const dots = relativeMatch[1].length;
            const modulePath = relativeMatch[2].replace(/\./g, '/');

            let directory = path.posix.dirname(normalizedImporter);

            for (let i = 1; i < dots; i++) {
                directory = path.posix.dirname(directory);
            }

            baseCandidates = [
                path.posix.join(directory, modulePath)
            ];
        } else {
            return undefined;
        }

    } else {
        // Package imports and unresolved aliases are not
        // treated as internal project dependencies.
        return undefined;
    }

    const extensions = [
        '', '.ts', '.tsx', '.js', '.jsx',
        '.py', '.vue', '.svelte',
        '/index.ts', '/index.tsx',
        '/index.js', '/index.jsx',
        '/__init__.py'
    ];

    for (const base of baseCandidates) {
        for (const suffix of extensions) {
            const candidate = normalizePath(base + suffix);
            const resolved = knownFiles.get(candidate);

            if (resolved) return resolved;
        }
    }

    return undefined;
}

export function getImpactFileOptions(
    snapshot: WorkspaceSnapshot
): string[] {
    return parseWorkspaceFiles(snapshot.source)
        .map(file => file.path)
        .sort((a, b) => a.localeCompare(b));
}

export function analyseChangeImpact(
    snapshot: WorkspaceSnapshot,
    changedFile: string,
    projectName: string
): ChangeImpactAnalysis {
    const files = parseWorkspaceFiles(snapshot.source);

    const knownFiles = new Map<string, string>();

    for (const file of files) {
        knownFiles.set(normalizePath(file.path), file.path);
    }

    const normalizedChangedFile = normalizePath(changedFile);
    const actualChangedFile = knownFiles.get(normalizedChangedFile);

    if (!actualChangedFile) {
        throw new Error(
            `The selected file "${changedFile}" was not found in the scanned source.`
        );
    }

    // Reverse dependency graph:
    // target file -> files that import the target.
    const dependents = new Map<string, Set<string>>();

    for (const file of files) {
        const imports = extractImports(file);

        for (const specifier of imports) {
            const target = resolveImport(
                file.path,
                specifier,
                knownFiles
            );

            if (!target) continue;

            const targetKey = normalizePath(target);
            const importerKey = normalizePath(file.path);

            if (targetKey === importerKey) continue;

            if (!dependents.has(targetKey)) {
                dependents.set(targetKey, new Set());
            }

            dependents.get(targetKey)!.add(file.path);
        }
    }

    const directDependents: ChangeImpactItem[] = [];
    const transitiveDependents: ChangeImpactItem[] = [];

    const visited = new Set<string>([
        normalizedChangedFile
    ]);

    const queue: Array<{
        file: string;
        depth: number;
        chain: string[];
    }> = [{
        file: actualChangedFile,
        depth: 0,
        chain: [actualChangedFile]
    }];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentKey = normalizePath(current.file);

        const nextFiles = [
            ...(dependents.get(currentKey) ?? [])
        ].sort();

        for (const dependent of nextFiles) {
            const dependentKey = normalizePath(dependent);

            if (visited.has(dependentKey)) continue;

            visited.add(dependentKey);

            const item: ChangeImpactItem = {
                file: dependent,
                depth: current.depth + 1,
                dependencyChain: [
                    ...current.chain,
                    dependent
                ]
            };

            if (item.depth === 1) {
                directDependents.push(item);
            } else {
                transitiveDependents.push(item);
            }

            queue.push({
                file: dependent,
                depth: item.depth,
                chain: item.dependencyChain
            });
        }
    }

    const observations: string[] = [
        'Impact is estimated from statically detected internal import relationships.',
        'Dynamic imports, runtime reflection, framework conventions and unresolved aliases may not be detected.',
        'A dependency relationship indicates potential impact, not proof that a change will cause a defect.'
    ];

    if (snapshot.fileCount >= 160) {
        observations.push(
            'The workspace scan reached its file limit. Some project files may not have been included.'
        );
    }

    const impactedCount =
        directDependents.length + transitiveDependents.length;

    const summary = impactedCount === 0
        ? `No internal dependents were detected for ${actualChangedFile}.`
        : `Changing ${actualChangedFile} may directly affect ${directDependents.length} file(s) and transitively affect ${transitiveDependents.length} additional file(s).`;

    return {
        projectName,
        changedFile: actualChangedFile,
        summary,
        directDependents,
        transitiveDependents,
        observations
    };
}
