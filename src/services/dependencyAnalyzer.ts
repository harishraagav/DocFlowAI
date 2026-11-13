import {
    WorkspaceSnapshot,
    DependencyAnalysis,
    DependencyItem,
    InternalModuleDependency
} from '../utilities/types';

import { parseWorkspaceSource } from './projectSourceUtils';

export function analyseDependencies(
    workspace: WorkspaceSnapshot
): DependencyAnalysis {

    const files = parseWorkspaceSource(workspace.source);

    const dependencies: DependencyItem[] = [];
    const internalDependencies: InternalModuleDependency[] = [];
    const observations: string[] = [];

    const seen = new Set<string>();

    function addDependency(
        name: string,
        version: string,
        category: DependencyItem['category'],
        ecosystem: string,
        sourceFile: string
    ): void {

        const cleanName = name.trim();

        if (!cleanName) return;

        const key = `${ecosystem}:${cleanName}`.toLowerCase();

        if (seen.has(key)) return;

        seen.add(key);

        dependencies.push({
            name: cleanName,
            version: version.trim() || 'Not specified',
            category,
            ecosystem,
            sourceFile
        });
    }

    for (const file of files) {

        const name = file.path.split('/').pop()?.toLowerCase() ?? '';

        // Node.js package.json
        if (name === 'package.json') {

            try {

                const manifest = JSON.parse(file.content);

                const sections: Array<{
                    key: string;
                    category: DependencyItem['category'];
                }> = [
                    { key: 'dependencies', category: 'runtime' },
                    { key: 'devDependencies', category: 'development' },
                    { key: 'optionalDependencies', category: 'optional' },
                    { key: 'peerDependencies', category: 'optional' }
                ];

                for (const section of sections) {

                    const entries = manifest[section.key];

                    if (!entries || typeof entries !== 'object') continue;

                    for (const [packageName, version] of Object.entries(entries)) {

                        addDependency(
                            packageName,
                            String(version),
                            section.category,
                            'npm',
                            file.path
                        );
                    }
                }

            } catch {
                observations.push(
                    `Could not parse ${file.path} as valid JSON.`
                );
            }
        }

        // Python requirements.txt
        if (name === 'requirements.txt') {

            for (const line of file.content.split(/\r?\n/)) {

                const trimmed = line.trim();

                if (
                    !trimmed ||
                    trimmed.startsWith('#') ||
                    trimmed.startsWith('-')
                ) continue;

                const match = trimmed.match(
                    /^([A-Za-z0-9_.-]+)\s*(?:==|>=|<=|~=|!=|>|<)\s*([^\s;]+)/ 
                );

                if (match) {
                    addDependency(
                        match[1],
                        match[2],
                        'runtime',
                        'Python / pip',
                        file.path
                    );
                    continue;
                }

                const unpinned = trimmed.match(
                    /^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?$/
                );

                if (unpinned) {
                    addDependency(
                        unpinned[1],
                        'Not pinned',
                        'runtime',
                        'Python / pip',
                        file.path
                    );
                }
            }
        }

        // Python pyproject.toml
        if (name === 'pyproject.toml') {

            let section = '';

            for (const line of file.content.split(/\r?\n/)) {

                const sectionMatch = line.match(/^\s*\[([^\]]+)\]/);

                if (sectionMatch) {
                    section = sectionMatch[1].toLowerCase();
                    continue;
                }

                if (
                    section.includes('dependencies') ||
                    section.includes('optional')
                ) {

                    const match = line.match(
                        /^\s*["']?([A-Za-z0-9_.-]+)["']?\s*(?:=|>=|<=|~=|==)\s*["']?([^"',\s\]]+)/
                    );

                    if (match) {
                        addDependency(
                            match[1],
                            match[2],
                            section.includes('optional')
                                ? 'optional'
                                : 'runtime',
                            'Python / pyproject',
                            file.path
                        );
                    }
                }
            }
        }

        // Go modules
        if (name === 'go.mod') {

            const requireBlock = file.content.match(
                /require\s*\(([\s\S]*?)\)/m
            );

            if (requireBlock) {

                for (const line of requireBlock[1].split(/\r?\n/)) {

                    const match = line.trim().match(
                        /^([^\s]+)\s+([^\s]+)/
                    );

                    if (match) {
                        addDependency(
                            match[1],
                            match[2],
                            'runtime',
                            'Go modules',
                            file.path
                        );
                    }
                }
            }

            const singleRequires = file.content.matchAll(
                /^require\s+([^\s]+)\s+([^\s]+)/gm
            );

            for (const match of singleRequires) {
                addDependency(
                    match[1],
                    match[2],
                    'runtime',
                    'Go modules',
                    file.path
                );
            }
        }

        // Rust Cargo.toml
        if (name === 'cargo.toml') {

            let section = '';

            for (const line of file.content.split(/\r?\n/)) {

                const sectionMatch = line.match(/^\s*\[([^\]]+)\]/);

                if (sectionMatch) {
                    section = sectionMatch[1].toLowerCase();
                    continue;
                }

                if (
                    !section.includes('dependencies') &&
                    !section.includes('dev-dependencies')
                ) continue;

                const match = line.match(
                    /^\s*([A-Za-z0-9_-]+)\s*=\s*(?:["']([^"']+)["']|\{[^}]*version\s*=\s*["']([^"']+)["'])/
                );

                if (match) {
                    addDependency(
                        match[1],
                        match[2] || match[3] || 'Not specified',
                        section.includes('dev')
                            ? 'development'
                            : 'runtime',
                        'Rust / Cargo',
                        file.path
                    );
                }
            }
        }

        // PHP composer.json
        if (name === 'composer.json') {

            try {

                const manifest = JSON.parse(file.content);

                for (const [section, category] of [
                    ['require', 'runtime'],
                    ['require-dev', 'development']
                ] as const) {

                    const entries = manifest[section];

                    if (!entries || typeof entries !== 'object') continue;

                    for (const [packageName, version] of Object.entries(entries)) {

                        if (packageName === 'php' || packageName === 'ext-*') {
                            continue;
                        }

                        addDependency(
                            packageName,
                            String(version),
                            category,
                            'PHP / Composer',
                            file.path
                        );
                    }
                }

            } catch {
                observations.push(
                    `Could not parse ${file.path} as valid JSON.`
                );
            }
        }

        // Maven pom.xml
        if (name === 'pom.xml') {

            const blocks = file.content.matchAll(
                /<dependency>([\s\S]*?)<\/dependency>/g
            );

            for (const block of blocks) {

                const group = block[1].match(
                    /<groupId>\s*([^<]+)\s*<\/groupId>/
                )?.[1];

                const artifact = block[1].match(
                    /<artifactId>\s*([^<]+)\s*<\/artifactId>/
                )?.[1];

                const version = block[1].match(
                    /<version>\s*([^<]+)\s*<\/version>/
                )?.[1];

                if (group && artifact) {
                    addDependency(
                        `${group}:${artifact}`,
                        version || 'Managed / unspecified',
                        'runtime',
                        'Java / Maven',
                        file.path
                    );
                }
            }
        }

        // Internal JavaScript / TypeScript imports
        if (/\.(ts|tsx|js|jsx|vue|svelte)$/.test(file.path)) {

            const importPatterns = [
                /(?:from\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g,
                /require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
                /import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
            ];

            for (const pattern of importPatterns) {

                for (const match of file.content.matchAll(pattern)) {

                    internalDependencies.push({
                        sourceFile: file.path,
                        targetModule: match[1],
                        importStatement: match[0].trim()
                    });
                }
            }
        }

        // Relative Python imports
        if (file.path.endsWith('.py')) {

            const pythonImports = file.content.matchAll(
                /^\s*(?:from\s+(\.+[A-Za-z0-9_.]*)\s+import|import\s+(\.+[A-Za-z0-9_.]*))/gm
            );

            for (const match of pythonImports) {

                const target = match[1] || match[2];

                if (!target) continue;

                internalDependencies.push({
                    sourceFile: file.path,
                    targetModule: target,
                    importStatement: match[0].trim()
                });
            }
        }
    }

    if (dependencies.length === 0) {
        observations.push(
            'No supported dependency manifest entries were detected in the scanned source.'
        );
    }

    if (workspace.fileCount >= 160) {
        observations.push(
            'The workspace scan reached its file limit. Additional manifests may not have been inspected.'
        );
    }

    return {
        projectName: 'Workspace Project',
        summary:
            `Detected ${dependencies.length} declared external dependencies and ` +
            `${internalDependencies.length} internal import relationships.`,
        dependencies,
        internalDependencies,
        observations
    };
}