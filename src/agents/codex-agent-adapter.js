import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export class CodexAgentAdapter {
  constructor({ enabled = process.env.USE_CODEX_AGENT === '1' } = {}) {
    this.enabled = enabled;
  }

  async run({ promptPath, payload, fallback }) {
    if (!this.enabled) {
      return fallback();
    }

    const codexCommand = process.env.CODEX_COMMAND || 'codex';
    const prompt = await fs.readFile(promptPath, 'utf8');
    const input = `${prompt}\n\nPayload:\n${JSON.stringify(payload, null, 2)}\n`;

    try {
      return await runCodexCommand(codexCommand, input);
    } catch (error) {
      console.warn(`[codex-adapter] Falling back to deterministic agent: ${error.message}`);
      return fallback();
    }
  }
}

function runCodexCommand(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['exec', '--'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(stderr || `Codex command exited with ${exitCode}`));
        return;
      }

      resolve({
        mode: 'codex',
        output: stdout.trim()
      });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

export function promptPath(fileName) {
  return path.resolve('prompts', fileName);
}
