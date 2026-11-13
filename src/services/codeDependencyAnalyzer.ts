import * as path from 'path';
import { parseWorkspaceSource, ParsedSourceFile } from './projectSourceUtils';

interface ImportReference {
    statement: string;
    specifier: string;
    line: number;
}

interface ResolvedReference extends ImportReference {
    resolvedFile?: string;
    classification: 'internal' | 'external-or-standard-library' | 'unresolved';
}

const RESOLVE_EXTENSIONS = [
    '.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.java', '.kt', '.go', '.rs', '.cs', '.php', '.rb', '.swift', '.json'
];

function extractImports(source: string): ImportReference[] {
    const imports: ImportReference[] = [];
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

        const pythonFrom = trimmed.match(/^from\s+([.\w]+)\s+import\s+.+/);
        const pythonImport = trimmed.match(/^import\s+([A-Za-z0-9_., ]+)/);
        const jsImport = trimmed.match(/(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        const javaImport = trimmed.match(/^import\s+(?:static\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)(?:\.\*)?;/);
        const csharpUsing = trimmed.match(/^using\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/);
        const goImport = trimmed.match(/^import\s+(?:[\w.]+\s+)?"([^"]+)"/);
        const rustUse = trimmed.match(/^use\s+([\w:]+)(?:::\{[^}]+\})?\s*;/);

        const specifiers: string[] = [];
        if (pythonFrom) specifiers.push(pythonFrom[1]);
        else if (jsImport) specifiers.push(jsImport[1] || jsImport[2] || jsImport[3]);
        else if (javaImport) specifiers.push(javaImport[1]);
        else if (csharpUsing) specifiers.push(csharpUsing[1]);
        else if (goImport) specifiers.push(goImport[1]);
        else if (rustUse) specifiers.push(rustUse[1]);
        else if (pythonImport) {
            specifiers.push(...pythonImport[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]));
        }

        for (const specifier of specifiers) {
            if (!specifier) continue;
            imports.push({ statement: trimmed, specifier, line: index + 1 });
        }
    });

    return imports;
}

function resolveLocalImport(
    importer: string,
    specifier: string,
    filesByPath: Map<string, ParsedSourceFile>
): string | undefined {
    const normalizedImporter = importer.replace(/\\/g, '/');
    const importerDirectory = path.posix.dirname(normalizedImporter);
    const candidates: string[] = [];

    if (specifier.startsWith('.')) {
        // Python relative imports use one leading dot for the current package
        // and each additional dot for one parent package. JavaScript uses ./.
        if (/^\.+/.test(specifier) && !specifier.startsWith('./') && !specifier.startsWith('../')) {
            const dots = specifier.match(/^\.+/)?.[0].length ?? 1;
            const moduleName = specifier.slice(dots).replace(/\./g, '/');
            let baseDirectory = importerDirectory;
            for (let i = 1; i < dots; i++) baseDirectory = path.posix.dirname(baseDirectory);
            candidates.push(moduleName ? path.posix.join(baseDirectory, moduleName) : baseDirectory);
        } else {
            candidates.push(path.posix.normalize(path.posix.join(importerDirectory, specifier)));
        }
    } else if (/^[A-Za-z0-9_.]+$/.test(specifier) && !specifier.includes('/')) {
        const modulePath = specifier.replace(/\./g, '/');
        candidates.push(modulePath);
        candidates.push(path.posix.join(importerDirectory, modulePath));
    } else {
        candidates.push(specifier);
    }

    for (const candidate of candidates) {
        const clean = candidate.replace(/^\.\//, '').replace(/\\/g, '/');
        const possible = [clean];
        for (const extension of RESOLVE_EXTENSIONS) possible.push(`${clean}${extension}`);
        for (const extension of RESOLVE_EXTENSIONS) possible.push(`${clean}/index${extension}`);
        possible.push(`${clean}/__init__.py`);

        for (const option of possible) {
            if (filesByPath.has(option)) return option;
        }
    }

    return undefined;
}

function resolveReferences(
    filePath: string,
    source: string,
    filesByPath: Map<string, ParsedSourceFile>
): ResolvedReference[] {
    return extractImports(source).map(reference => {
        const resolvedFile = resolveLocalImport(filePath, reference.specifier, filesByPath);
        return {
            ...reference,
            resolvedFile,
            classification: resolvedFile
                ? 'internal'
                : 'external-or-standard-library'
        };
    });
}

export function analyzeCodeDependencies(
    filePath: string,
    fileContent: string,
    workspaceSource: string
): string {
    const files = parseWorkspaceSource(workspaceSource);
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const filesByPath = new Map(files.map(file => [file.path, file]));

    if (!filesByPath.has(normalizedPath)) {
        filesByPath.set(normalizedPath, { path: normalizedPath, content: fileContent });
    }

    const direct = resolveReferences(normalizedPath, fileContent, filesByPath);
    const visited = new Set<string>([normalizedPath]);
    const chains: Array<{ path: string; chain: string[] }> = [];
    const queue: Array<{ path: string; chain: string[] }> = [];

    for (const item of direct) {
        if (item.resolvedFile && !visited.has(item.resolvedFile)) {
            visited.add(item.resolvedFile);
            queue.push({ path: item.resolvedFile, chain: [normalizedPath, item.resolvedFile] });
        }
    }

    while (queue.length > 0 && visited.size < 100) {
        const current = queue.shift()!;
        if (current.chain.length > 2) chains.push(current);
        const file = filesByPath.get(current.path);
        if (!file) continue;

        const nested = resolveReferences(current.path, file.content, filesByPath);
        for (const reference of nested) {
            if (!reference.resolvedFile || visited.has(reference.resolvedFile)) continue;
            visited.add(reference.resolvedFile);
            queue.push({
                path: reference.resolvedFile,
                chain: [...current.chain, reference.resolvedFile]
            });
        }
    }

    const lines: string[] = [
        `# Code Dependency Report — ${normalizedPath}`,
        '',
        `**Generated:** ${new Date().toLocaleString()}`,
        '',
        '## 1. Direct Imports',
        ''
    ];

    if (direct.length === 0) {
        lines.push('No supported import statements were detected in this file.', '');
    } else {
        for (const item of direct) {
            lines.push(
                `- **${item.specifier}** — ${item.classification === 'internal'
                    ? `Internal project file: \`${item.resolvedFile}\``
                    : 'Not resolved to a scanned workspace file (may be a package, standard library module, or unsupported local import)'}`,
                `  - Line ${item.line}: \`${item.statement}\``
            );
        }
        lines.push('');
    }

    lines.push('## 2. Transitive Internal Dependencies', '');
    if (chains.length === 0) {
        lines.push('No additional internal dependency files were resolved beyond the direct imports.', '');
    } else {
        for (const item of chains) {
            lines.push(`- \`${item.path}\``, `  - Chain: ${item.chain.map(part => `\`${part}\``).join(' → ')}`);
        }
        lines.push('');
    }

    lines.push(
        '## 3. Dependency Summary',
        '',
        `- Direct import statements detected: ${direct.length}`,
        `- Direct internal files resolved: ${direct.filter(item => item.resolvedFile).length}`,
        `- Additional transitive internal files: ${chains.length}`,
        `- Unresolved external / standard-library / unsupported references: ${direct.filter(item => !item.resolvedFile).length}`,
        '',
        '## 4. Scope and Limitations',
        '',
        '- Import extraction uses lightweight language-specific patterns; it is not a complete parser.',
        '- Dynamic imports, reflection, runtime plugin loading and generated modules may not be detected.',
        '- A reference not resolved to a scanned file is not automatically proof of an external package; it may be a standard-library or unsupported local import.',
        '- Only files included in the workspace scan can be followed.',
        '',
        '---',
        '',
        '*Generated by DocFlowAI.*'
    );

    return lines.join('\n');
}
