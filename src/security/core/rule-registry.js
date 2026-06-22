import { sortFindingsBySeverity } from './severity.js';

export async function runSecurityRules({ rules, context }) {
  const findings = [];

  for (const rule of rules) {
    if (!rule?.run) {
      continue;
    }

    if (rule.appliesTo && !rule.appliesTo.some((scope) => context.scopes?.includes(scope))) {
      continue;
    }

    findings.push(...await rule.run(context));
  }

  return sortFindingsBySeverity(findings);
}

export function rulesForChecks(registry, checks) {
  const selected = new Set(checks);
  return registry.filter((rule) => selected.has(rule.check) || selected.has(rule.category) || selected.has(rule.id));
}
