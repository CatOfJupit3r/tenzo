export function normalizeOpenAiCompatibleBaseUrl(endpoint: string) {
  const trimmedEndpoint = endpoint.trim().replace(/\/$/, '');

  if (trimmedEndpoint.endsWith('/v1/chat/completions')) {
    return trimmedEndpoint.slice(0, -'/chat/completions'.length);
  }

  if (trimmedEndpoint.endsWith('/chat/completions')) {
    return trimmedEndpoint.slice(0, -'/chat/completions'.length);
  }

  if (trimmedEndpoint.endsWith('/v1')) {
    return trimmedEndpoint;
  }

  return `${trimmedEndpoint}/v1`;
}

export function normalizeChatCompletionsEndpoint(endpoint: string) {
  return `${normalizeOpenAiCompatibleBaseUrl(endpoint)}/chat/completions`;
}
