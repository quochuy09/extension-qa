import { spawn } from 'node:child_process';
import { resolveActionLogPath } from './action-log-file.js';

const options = parseArgs(process.argv.slice(2));
const actionLogPath = await resolveActionLogPath(options.actionLogPath);
const playwrightArgs = ['node_modules/playwright/cli.js', 'test', 'tests/action-log-runtime.spec.js'];

if (options.headed) {
  playwrightArgs.push('--headed');
}

console.log(`Action log: ${actionLogPath}`);
console.log(`Browser mode: ${options.headed ? 'headed' : 'headless'}`);

const child = spawn(
  process.execPath,
  playwrightArgs,
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ACTION_LOG: actionLogPath,
      ACTION_LOG_RUNTIME: '1'
    },
    stdio: 'inherit'
  }
);

child.on('close', (exitCode) => {
  process.exit(exitCode ?? 1);
});

function parseArgs(args) {
  const options = {
    headed: false,
    actionLogPath: null
  };

  for (const arg of args) {
    if (arg === '--headed') {
      options.headed = true;
      continue;
    }

    if (!options.actionLogPath) {
      options.actionLogPath = arg;
    }
  }

  return options;
}
