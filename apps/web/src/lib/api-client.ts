const BASE_URL = import.meta.env.VITE_API_URL || '';

export function getApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  return `${BASE_URL}${path}`;
}

function buildRequestHeaders(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined && init?.body !== null) {
    headers['Content-Type'] = 'application/json';
  }
  if (init?.headers) {
    if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value;
      }
    } else if (typeof (init.headers as Headers).forEach === 'function') {
      (init.headers as Headers).forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }
  return headers;
}

function notifyForbiddenOrganization(status: number, message: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (message.includes('FORBIDDEN_ORGANIZATION_ACCESS')) {
    window.dispatchEvent(
      new CustomEvent('auth:forbidden-organization', {
        detail: { status, message },
      }),
    );
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  const requestHeaders = buildRequestHeaders(init);

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: requestHeaders,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    let errorMessage = `HTTP error ${response.status}`;
    if (errorBody.message) {
      errorMessage = errorBody.message;
    }
    notifyForbiddenOrganization(response.status, errorMessage);
    throw new Error(errorMessage);
  }

  return response.json();
}
