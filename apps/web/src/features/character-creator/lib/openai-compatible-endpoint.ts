export function normalizeOpenAiCompatibleBaseUrl(endpoint: string) {
  const trimmedEndpoint = endpoint.trim().replace(/\/$/, '');

  if (trimmedEndpoint.endsWith('/v1/chat/completions')) {
    return trimmedEndpoint.slice(0, -'/v1/chat/completions'.length);
  }

  if (trimmedEndpoint.endsWith('/chat/completions')) {
    return trimmedEndpoint.slice(0, -'/chat/completions'.length);
  }

  if (trimmedEndpoint.endsWith('/v1')) {
    return trimmedEndpoint.slice(0, -'/v1'.length);
  }

  return trimmedEndpoint;
}

export function normalizeChatCompletionsEndpoint(endpoint: string) {
  return `${normalizeOpenAiCompatibleBaseUrl(endpoint)}/v1/chat/completions`;
}
