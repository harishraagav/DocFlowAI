
import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder } from 'util';
import { WorkspaceSnapshot } from '../utilities/types';

const MAX_FILES = 160;
const MAX_FILE_SIZE = 40_000;
const MAX_TOTAL_CONTEXT = 100_000;

const IGNORED_DIRECTORIES = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    'coverage', 'venv', '.venv', '__pycache__',
    'DocFlowAI_Code_Explanations', 'DocFlowAI_Code_Dependencies',
    'DocFlowAI_Function_Documentation', 'DocFlowAI_Code_Improvements',
    '.next', '.nuxt', '.turbo', 'target', 'vendor',
    'chroma_langchain_db', '.idea', '.vscode-test', 'DocFlowAI_File_Documentation'
]);

const IGNORED_FILES = new Set([
    '.env', '.env.local', '.env.production',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'bun.lockb', 'Cargo.lock', 'poetry.lock',
    'System_Architecture.png',
    'System_Architecture.eraser.json',
    'DocFlow_System_Architecture.md',
    'DocFlowAI_Activity_Log.md', 'DocFlowAI_Documentation_Bundle.md',
    'README_DocFlowAI.md', 'DOCFLOWAI_FEATURES_17_23.md', 'API_Documentation.md',
'Technical_Documentation.md', 'ONBOARDING_GUIDE.md'
]);

const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java',
    '.kt', '.go', '.rs', '.cpp', '.c', '.h', '.cs',
    '.php', '.rb', '.swift', '.vue', '.svelte',
    '.html', '.css', '.scss', '.sql', '.json',
    '.yaml', '.yml', '.toml', '.xml', '.md',
    '.sh', '.bat', '.ps1'
]);

function shouldIgnore(name: string): boolean {
    const lower = name.toLowerCase();

    return (
        IGNORED_FILES.has(name) ||
        lower.startsWith('.env') ||
        lower.includes('secret') ||
        lower.includes('credential')
    );
}

export async function scanWorkspace(
    rootUri: vscode.Uri
): Promise<WorkspaceSnapshot> {
    let tree = '';
    let source = '';
    let fileCount = 0;
    let totalCharacters = 0;

    const decoder = new TextDecoder();

    async function walk(
        directory: vscode.Uri,
        depth: number
    ): Promise<void> {
        if (depth > 12 || fileCount >= MAX_FILES) {
            return;
        }

        const entries = await vscode.workspace.fs.readDirectory(
            directory
        );

        for (const [name, type] of entries) {
            if (fileCount >= MAX_FILES) break;
            if (IGNORED_DIRECTORIES.has(name)) continue;
            if (shouldIgnore(name)) continue;

            const childUri = vscode.Uri.joinPath(directory, name);

            const relativePath = path.relative(
                rootUri.fsPath,
                childUri.fsPath
            ).replace(/\\/g, '/');

            if (type === vscode.FileType.Directory) {
                tree += `📁 ${relativePath}/\n`;
                await walk(childUri, depth + 1);
                continue;
            }

            if (type !== vscode.FileType.File) continue;

            fileCount++;
            tree += `📄 ${relativePath}\n`;

            const extension = path.extname(name).toLowerCase();

            if (
                !SOURCE_EXTENSIONS.has(extension) &&
                name.toLowerCase() !== 'requirements.txt'
            ) continue;
            if (totalCharacters >= MAX_TOTAL_CONTEXT) continue;

            try {
                const stat = await vscode.workspace.fs.stat(childUri);

                if (stat.size > MAX_FILE_SIZE) continue;

                const bytes = await vscode.workspace.fs.readFile(childUri);
                const content = decoder.decode(bytes);

                const remaining = MAX_TOTAL_CONTEXT - totalCharacters;
                const excerpt = content.slice(
                    0,
                    Math.min(MAX_FILE_SIZE, remaining)
                );

                source +=
                    `\n\n========== FILE: ${relativePath} ==========\n` +
                    excerpt;

                totalCharacters += excerpt.length;
            } catch (error) {
                console.warn(
                    `DocFlowAI: Could not read ${relativePath}`,
                    error
                );
            }
        }
    }

    await walk(rootUri, 0);

    return {
        tree,
        source,
        fileCount,
        totalCharacters
    };
}
