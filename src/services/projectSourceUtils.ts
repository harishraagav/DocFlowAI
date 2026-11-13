export interface ParsedSourceFile {
    path: string;
    content: string;
}

export function parseWorkspaceSource(
    source: string
): ParsedSourceFile[] {

    const parts = source.split(
        /\n\s*={3,}\s*FILE:\s*(.*?)\s*={3,}\s*\n/
    );

    const files: ParsedSourceFile[] = [];

    for (let i = 1; i < parts.length; i += 2) {

        const filePath = parts[i]?.trim();
        const content = parts[i + 1] ?? '';

        if (!filePath) continue;

        files.push({
            path: filePath.replace(/\\/g, '/'),
            content
        });
    }

    return files;
}

export function getProjectName(tree: string): string {

    const firstFile = tree.match(/FILE:\s*(.+)/)?.[1];

    if (firstFile) {
        const parts = firstFile.split(/[\\/]/);
        return parts[0] || 'Unknown Project';
    }

    return 'Workspace Project';
}