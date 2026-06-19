import { chromium } from '@playwright/test';
import { installRecorder, writeRecording } from './recording-core.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:4173';
const outputPath = process.env.ACTION_LOG || 'logs/action-log.json';
const actions = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await installRecorder(page, (action) => {
  actions.push(action);
});

await page.goto(baseUrl);
await page.getByTestId('username-input').fill('standard_user');
await page.getByTestId('username-input').dispatchEvent('change');
await page.getByTestId('password-input').fill('secret_sauce');
await page.getByTestId('password-input').dispatchEvent('change');
await page.getByTestId('login-button').click();
await page.getByTestId('add-to-cart-bento-stand').click();
await page.getByTestId('nav-cart').click();
await page.getByTestId('checkout-button').click();
await page.getByTestId('full-name-input').fill('Taro Yamada');
await page.getByTestId('full-name-input').dispatchEvent('change');
await page.getByTestId('postal-code-input').fill('100-0001');
await page.getByTestId('postal-code-input').dispatchEvent('change');
await page.getByTestId('place-order-button').click();

const recording = await writeRecording(actions, outputPath);

console.log(`Saved ${recording.actions.length} actions to ${outputPath}`);
console.log(`Groups: ${recording.groups.map((group) => group.name).join(' -> ')}`);

await browser.close();
