export function createPlaywrightSecurityObserver(page, options = {}) {
  const origin = options.baseURL ? new URL(options.baseURL).origin : null;
  const responses = [];
  const dialogs = [];
  const consoleErrors = [];
  const pageErrors = [];
  const sensitiveHeaderPattern = /authorization|cookie|set-cookie|token|secret|credential/i;
  const sensitiveBodyPattern = /password|token|secret|credential|authorization|cookie/i;

  page.on('dialog', async (dialog) => {
    dialogs.push({
      type: dialog.type(),
      message: dialog.message()
    });
    await dialog.dismiss().catch(() => {});
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (origin && !url.startsWith(origin)) {
      return;
    }

    const request = response.request();
    const resourceType = request.resourceType();
    if (!['document', 'fetch', 'xhr'].includes(resourceType)) {
      return;
    }

    const requestBody = request.postData();
    const sanitizedRequestBody = sanitizeBody(requestBody);
    const entry = {
      url,
      method: request.method(),
      status: response.status(),
      headers: response.headers(),
      requestHeaders: sanitizeHeaders(request.headers()),
      requestBody: sanitizedRequestBody,
      requestBodyRedacted: sanitizedRequestBody !== requestBody,
      requestBodySensitive: isSensitiveBody(requestBody),
      resourceType,
      body: ''
    };

    try {
      const contentType = response.headers()['content-type'] || '';
      if (/json|text|html|xml|javascript/i.test(contentType)) {
        entry.body = await response.text();
      }
    } catch {
      entry.body = '';
    }

    responses.push(entry);
  });

  return {
    responses,
    dialogs,
    consoleErrors,
    pageErrors,
    snapshot() {
      return {
        responses: [...responses],
        dialogs: [...dialogs],
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors]
      };
    }
  };

  function sanitizeHeaders(headers) {
    return Object.fromEntries(
      Object.entries(headers || {}).map(([name, value]) => [
        name,
        sensitiveHeaderPattern.test(name) ? '[redacted]' : String(value)
      ])
    );
  }

  function sanitizeBody(body) {
    if (body == null) {
      return null;
    }

    const raw = String(body);
    if (!sensitiveBodyPattern.test(raw)) {
      return raw;
    }

    try {
      return JSON.stringify(redactObject(JSON.parse(raw)));
    } catch {
      return raw.replace(/([^&=]*?(password|token|secret|credential|authorization|cookie)[^&=]*=)[^&\s]+/gi, '$1[redacted]');
    }
  }

  function isSensitiveBody(body) {
    if (body == null) {
      return false;
    }

    return sensitiveBodyPattern.test(String(body));
  }

  function redactObject(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(redactObject);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sensitiveBodyPattern.test(key) ? '[redacted]' : redactObject(child)
      ])
    );
  }
}
