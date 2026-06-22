import { ActionLogContractError, adaptActionLog } from './action-log-contract-adapter.js';
import { readActionLog } from '../runtime/action-log-file.js';

try {
  const { filePath: actionLogPath, actionLog } = await readActionLog(process.argv[2]);
  const contract = adaptActionLog(actionLog);
  console.log(`Action log OK: ${actionLogPath}`);
  console.log(`Test case: ${contract.testCase.name}`);
  console.log(`Groups: ${contract.groups.length}`);
  console.log(`Actions: ${contract.actions.length}`);
} catch (error) {
  if (error instanceof ActionLogContractError) {
    console.error(error.message);
    error.details.forEach((detail) => console.error(`- ${detail}`));
    process.exit(1);
  }

  throw error;
}
