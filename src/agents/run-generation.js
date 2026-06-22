import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GeneratorAgent } from './generator-agent.js';
import { ReviewerAgent } from './reviewer-agent.js';
import { readActionLog } from '../runtime/action-log-file.js';
import { classifyRuntimeResult } from '../runtime/runtime-result-classifier.js';

const maxReviewRounds = Number(process.env.MAX_REVIEW_ROUNDS || 3);
const maxRuntimeAttempts = Number(process.env.MAX_RUNTIME_ATTEMPTS || 3);
const generationLogPath = 'artifacts/generation-log.json';

const { filePath: actionLogPath, actionLog: recording } = await readActionLog(process.argv[2]);
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
    await writeGeneratedFiles(generated);

    review = await reviewer.review({ code: reviewableCode(generated) });
    generationLog.push({
      runtimeAttempt: attempt,
      reviewRound: round,
      actionLogPath,
      generator: generated.agent,
      generatorMode: generated.mode,
      reviewer: review.agent,
      reviewerMode: review.mode,
      approved: review.approved,
      findings: review.findings,
      targetPath: generated.targetPath,
      files: generatedFiles(generated).map((file) => file.path)
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

  runtimeResult = await runPlaywright(generated.targetPath);
  const runtimeClassification = classifyRuntimeResult(runtimeResult);
  generationLog.push({
    runtimeValidation: {
      attempt,
      command: `${process.execPath} node_modules/playwright/cli.js test ${generated.targetPath}`,
      passed: runtimeResult.exitCode === 0,
      exitCode: runtimeResult.exitCode,
      summary: summarizeRuntimeOutput(runtimeResult.output),
      classification: runtimeClassification,
      artifacts: {
        jsonReport: 'artifacts/playwright-results.json',
        outputDir: 'test-results'
      }
    }
  });

  if (runtimeResult.exitCode === 0) {
    break;
  }

  runtimeFeedback = {
    id: 'runtime-validation-failed',
    severity: 'high',
    message: 'Playwright runtime validation failed. Regenerate using the captured runner output.',
    summary: summarizeRuntimeOutput(runtimeResult.output),
    classification: runtimeClassification
  };
}

await writeGenerationLog(generationLog);

if (runtimeResult.exitCode !== 0) {
  console.error(runtimeResult.output);
  throw new Error('Runtime validation failed. Feed this output back into the generator in the next iteration.');
}

console.log(`Generated test: ${generated.targetPath}`);
for (const file of generatedFiles(generated)) {
  console.log(`Generated file: ${file.path}`);
}
console.log(`Generation log: ${generationLogPath}`);

async function runPlaywright(testPath) {
  return new Promise((resolve) => {
    const playwrightCli = path.resolve('node_modules/playwright/cli.js');
    const child = spawn(process.execPath, [playwrightCli, 'test', testPath], {
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

async function writeGeneratedFiles(generatedOutput) {
  for (const file of generatedFiles(generatedOutput)) {
    await writeFileEnsuringDir(file.path, file.code);
  }
}

function generatedFiles(generatedOutput) {
  if (Array.isArray(generatedOutput.files) && generatedOutput.files.length > 0) {
    return generatedOutput.files;
  }

  return [
    {
      path: generatedOutput.targetPath,
      code: generatedOutput.code
    }
  ];
}

function reviewableCode(generatedOutput) {
  return generatedFiles(generatedOutput)
    .map((file) => `// FILE: ${file.path}\n${file.code}`)
    .join('\n\n');
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
