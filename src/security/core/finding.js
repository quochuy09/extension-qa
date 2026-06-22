export function createFinding({
  id,
  title,
  category,
  severity = 'medium',
  owasp = null,
  cwe = null,
  url = null,
  status = null,
  step = null,
  actionId = null,
  payload = null,
  evidence = null,
  reason,
  risk,
  fix
}) {
  return {
    id,
    title: title || id,
    category: category || 'security',
    severity,
    owasp,
    cwe,
    url,
    status,
    step,
    actionId,
    payload,
    evidence,
    reason,
    risk,
    fix
  };
}
