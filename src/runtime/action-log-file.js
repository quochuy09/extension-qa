import fs from 'node:fs/promises';
import path from 'node:path';

export async function resolveActionLogPath(inputPath = process.env.ACTION_LOG) {
  if (inputPath) {
    return path.resolve(inputPath);
  }

  const defaultPath = path.resolve('logs/action-log.json');
  if (await exists(defaultPath)) {
    return defaultPath;
  }

  const logDir = path.resolve('logs');
  const jsonFiles = await listJsonFiles(logDir);
  if (jsonFiles.length === 1) {
    return jsonFiles[0];
  }

  if (jsonFiles.length > 1) {
    throw new Error(`Multiple JSON files found in logs/. Please choose one: ${jsonFiles.map((file) => path.basename(file)).join(', ')}`);
  }

  throw new Error('No action log JSON found. Put a file in logs/ or pass a path.');
}

export async function readActionLog(inputPath = process.env.ACTION_LOG) {
  const filePath = await resolveActionLogPath(inputPath);
  const content = await fs.readFile(filePath, 'utf8');
  return {
    filePath,
    actionLog: JSON.parse(content)
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => path.join(directoryPath, entry.name));
  } catch {
    return [];
  }
}
