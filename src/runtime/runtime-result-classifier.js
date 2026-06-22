export function classifyRuntimeResult({ exitCode, output = '' }) {
  if (exitCode === 0) {
    return {
      status: 'passed',
      category: 'none',
      retryableByHealing: false,
      reason: 'Playwright runtime validation passed.'
    };
  }

  const normalizedOutput = String(output);
  const lowerOutput = normalizedOutput.toLowerCase();

  if (isSelectorFailure(lowerOutput)) {
    return {
      status: 'failed',
      category: 'selector-failure',
      retryableByHealing: true,
      reason: firstMatchingLine(normalizedOutput, [
        /locator\(.+\).*timed out/i,
        /waiting for .+locator/i,
        /getByTestId\(.+\)/i,
        /TimeoutError/i
      ]) || 'Playwright failed while waiting for a locator.'
    };
  }

  if (isAssertionFailure(lowerOutput)) {
    return {
      status: 'failed',
      category: 'assertion-failure',
      retryableByHealing: false,
      reason: firstMatchingLine(normalizedOutput, [
        /expect\(.+\)/i,
        /Error: expect/i,
        /toBeVisible|toHaveText|toContainText/i
      ]) || 'Playwright assertion failed.'
    };
  }

  if (lowerOutput.includes('error:') || lowerOutput.includes('typeerror') || lowerOutput.includes('syntaxerror')) {
    return {
      status: 'failed',
      category: 'runtime-error',
      retryableByHealing: false,
      reason: firstMatchingLine(normalizedOutput, [/Error:/i, /TypeError/i, /SyntaxError/i]) || 'Generated test failed with a runtime error.'
    };
  }

  return {
    status: 'failed',
    category: 'unknown',
    retryableByHealing: false,
    reason: 'Runtime validation failed, but no known failure category matched.'
  };
}

function isSelectorFailure(output) {
  return (
    output.includes('locator') &&
    (
      output.includes('timeout') ||
      output.includes('waiting for') ||
      output.includes('strict mode violation') ||
      output.includes('resolved to 0 elements')
    )
  );
}

function isAssertionFailure(output) {
  return (
    output.includes('error: expect') ||
    output.includes('expect(') ||
    output.includes('tobevisible') ||
    output.includes('tohavetext') ||
    output.includes('tocontaintext')
  );
}

function firstMatchingLine(output, patterns) {
  const lines = String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const pattern of patterns) {
    const matched = lines.find((line) => pattern.test(line));
    if (matched) {
      return matched;
    }
  }

  return null;
}
