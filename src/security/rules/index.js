import { dataExposureRule } from './data-exposure-rule.js';
import { securityHeadersRule } from './security-headers-rule.js';
import { sessionCookieRule } from './session-cookie-rule.js';

export const responseSecurityRules = [
  securityHeadersRule,
  sessionCookieRule,
  dataExposureRule
];
