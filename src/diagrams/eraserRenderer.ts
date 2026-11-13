
import * as path from 'path';
import * as fs from 'fs';

let renderer: any;

function getChromiumPath(): string {
    const candidates = [
        process.env.CHROMIUM_PATH,
        process.env.CHROME_PATH,

        process.env.LOCALAPPDATA
            ? path.join(
                process.env.LOCALAPPDATA,
                'Google',
                'Chrome',
                'Application',
                'chrome.exe'
            )
            : undefined,

        process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                'Google',
                'Chrome',
                'Application',
                'chrome.exe'
            )
            : undefined,

        process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe'
            )
            : undefined,

        process.env['PROGRAMFILES(X86)']
            ? path.join(
                process.env['PROGRAMFILES(X86)'],
                'Microsoft',
                'Edge',
                'Application',
                'msedge.exe'
            )
            : undefined
    ];

    const found = candidates.find(
        (candidate): candidate is string =>
            Boolean(candidate && fs.existsSync(candidate))
    );

    if (!found) {
        throw new Error(
            'Chrome or Edge was not found. Set CHROME_PATH ' +
            'to the browser executable.'
        );
    }

    return found;
}

export async function getEraserRenderer(): Promise<any> {
    if (renderer) {
        return renderer;
    }

    const chromiumPath = getChromiumPath();

    const { createRenderer } = await import('@eraserlabs/diagrams');

    renderer = await createRenderer({
        chromiumPath
    });

    return renderer;
}

export async function ensureEraserRenderer(): Promise<void> {
    await getEraserRenderer();
}

export async function renderEraserDiagram(
    diagram: any
): Promise<Buffer> {
    const activeRenderer = await getEraserRenderer();

    const outcome = await activeRenderer.render(diagram);

    if (!outcome.ok) {
        throw new Error(
            `Eraser rendering failed: ${JSON.stringify(outcome)}`
        );
    }

    if (!outcome.png) {
        throw new Error(
            'Eraser did not return a PNG image.'
        );
    }

    return outcome.png as Buffer;
}

export async function closeEraserRenderer(): Promise<void> {
    if (!renderer) return;

    await renderer.close();
    renderer = undefined;
}
