
import { generateAI } from './aiProvider';

export async function callOllama(
    prompt: string,
    jsonMode = false
): Promise<string> {
    return generateAI(prompt, { jsonMode });
}
