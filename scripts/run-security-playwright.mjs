import { spawn } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const checks = checksFromArgs(args);
const headed = isHeaded(args);
const demoMode = headed || process.env.SECURITY_DEMO === '1';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js');
const server = await ensureServer(baseURL);
const code = await runPlaywright();

if (server.started && server.process) {
  server.process.kill();
}

process.exit(code);

function runPlaywright() {
  return new Promise((resolve) => {
    const playwrightArgs = [
      playwrightCli,
      'test',
      '--config=playwright.security.config.ts',
      'tests/security/action-log-security.spec.js'
    ];

    if (headed) {
      playwrightArgs.push('--headed');
    }

    const passThroughArgs = args.filter((arg) => !['xss', 'headers', '--headed'].includes(arg) && !arg.startsWith('--checks='));
    playwrightArgs.push(...passThroughArgs);

    const child = spawn(process.execPath, playwrightArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_URL: baseURL,
        SECURITY_RUNTIME: '1',
        SECURITY_CHECKS: checks,
        SECURITY_DEMO: demoMode ? '1' : process.env.SECURITY_DEMO || ''
      }
    });

    child.on('exit', (exitCode) => resolve(exitCode ?? 1));
  });
}

function checksFromArgs(values) {
  const explicitCheck = values.find((value) => ['xss', 'headers'].includes(value));
  const checkOption = values.find((value) => value.startsWith('--checks='));
  return explicitCheck || checkOption?.split('=').slice(1).join('=') || process.env.SECURITY_CHECKS || 'xss';
}

function isHeaded(values) {
  if (values.includes('--headed')) {
    return true;
  }

  if (process.env.HEADED === '1') {
    return true;
  }

  return String(process.env.HEADLESS || '').toLowerCase() === 'false';
}

async function ensureServer(url) {
  if (await isHealthy(url)) {
    return { started: false, process: null };
  }

  const child = spawn(process.execPath, ['src/app/server.js'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: new URL(url).port || '4173'
    }
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isHealthy(url)) {
      return { started: true, process: child };
    }
    await delay(500);
  }

  child.kill();
  throw new Error(`Security test server did not become healthy at ${url}/health.`);
}

async function isHealthy(url) {
  try {
    const response = await fetch(new URL('/health', url));
    return response.ok;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
