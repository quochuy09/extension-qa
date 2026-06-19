import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GeneratorAgent } from './generator-agent.js';
import { ReviewerAgent } from './reviewer-agent.js';

const actionLogPath = process.env.ACTION_LOG || 'logs/action-log.json';
const maxReviewRounds = Number(process.env.MAX_REVIEW_ROUNDS || 3);
const maxRuntimeAttempts = Number(process.env.MAX_RUNTIME_ATTEMPTS || 3);
const generationLogPath = 'artifacts/generation-log.json';

const recording = JSON.parse(await fs.readFile(actionLogPath, 'utf8'));
const generator = new GeneratorAgent();
const reviewer = new ReviewerAgent();
const generationLog = [];

let reviewFeedback = [];
let runtimeFeedback = null;
let generated = null;
let review = null;
let runtimeResult = null;

for (let attempt = 1; attempt <= maxRuntimeAttempts; attempt += 1) {
  reviewFeedback = runtimeFeedback ? [runtimeFeedback] : [];

  for (let round = 1; round <= maxReviewRounds; round += 1) {
    generated = await generator.generate({ recording, reviewFeedback, runtimeFeedback });
    await writeFileEnsuringDir(generated.targetPath, generated.code);

    review = await reviewer.review({ code: generated.code });
    generationLog.push({
      runtimeAttempt: attempt,
      reviewRound: round,
      generator: generated.agent,
      generatorMode: generated.mode,
      reviewer: review.agent,
      reviewerMode: review.mode,
      approved: review.approved,
      findings: review.findings,
      targetPath: generated.targetPath
    });

    console.log(`[attempt ${attempt} round ${round}] reviewer approved: ${review.approved}`);
    if (review.approved) {
      break;
    }

    reviewFeedback = review.findings;
  }

  if (!review?.approved) {
    await writeGenerationLog(generationLog);
    throw new Error(`Reviewer did not approve after ${maxReviewRounds} rounds.`);
  }

  runtimeResult = await runPlaywright();
  generationLog.push({
    runtimeValidation: {
      attempt,
      command: `${process.execPath} node_modules/playwright/cli.js test`,
      passed: runtimeResult.exitCode === 0,
      exitCode: runtimeResult.exitCode,
      summary: summarizeRuntimeOutput(runtimeResult.output)
    }
  });

  if (runtimeResult.exitCode === 0) {
    break;
  }

  runtimeFeedback = {
    id: 'runtime-validation-failed',
    severity: 'high',
    message: 'Playwright runtime validation failed. Regenerate using the captured runner output.',
    summary: summarizeRuntimeOutput(runtimeResult.output)
  };
}

await writeGenerationLog(generationLog);

if (runtimeResult.exitCode !== 0) {
  console.error(runtimeResult.output);
  throw new Error('Runtime validation failed. Feed this output back into the generator in the next iteration.');
}

console.log(`Generated test: ${generated.targetPath}`);
console.log(`Generation log: ${generationLogPath}`);

async function runPlaywright() {
  return new Promise((resolve) => {
    const playwrightCli = path.resolve('node_modules/playwright/cli.js');
    const child = spawn(process.execPath, [playwrightCli, 'test'], {
      cwd: process.cwd(),
      env: process.env
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('close', (exitCode) => {
      resolve({ exitCode, output });
    });
  });
}

async function writeFileEnsuringDir(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeGenerationLog(log) {
  await writeFileEnsuringDir(generationLogPath, `${JSON.stringify(log, null, 2)}\n`);
}

function summarizeRuntimeOutput(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/[^\x20-\x7E]/g, '>'))
    .filter(Boolean);

  return lines.slice(-8).join(' | ');
}
