import { chromium } from '@playwright/test';
import { installRecorder, writeRecording } from './recording-core.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:4173';
const outputPath = process.env.ACTION_LOG || 'logs/action-log.json';
const actions = [];

console.log(`Opening recorder at ${baseUrl}`);
console.log('Complete the flow in the browser, then press Enter in this terminal to save the action log.');

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await installRecorder(page, (action) => {
  actions.push(action);
  console.log(`[recorded] ${action.type} ${action.elementSignature}`);
});

await page.goto(baseUrl);

process.stdin.resume();
process.stdin.once('data', async () => {
  const recording = await writeRecording(actions, outputPath);
  console.log(`Saved ${recording.actions.length} actions to ${outputPath}`);
  await browser.close();
  process.exit(0);
});
