export async function buildGenerationErrorMessage(response: Response) {
  const errorText = (await response.text()).trim();
  return errorText || `${response.status} ${response.statusText}`.trim();
}

export async function readTextResponseStream({
  response,
  onContent,
  signal,
}: {
  response: Response;
  onContent: (content: string) => unknown;
  signal?: AbortSignal;
}) {
  if (!response.body) {
    const text = await response.text();

    if (text) {
      onContent(text);
    }

    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError');
    }

    const { done: isDone, value } = await reader.read();

    if (isDone) {
      break;
    }

    const textChunk = decoder.decode(value, { stream: true });

    if (!textChunk) {
      continue;
    }

    fullContent += textChunk;
    onContent(textChunk);
  }

  const remainingChunk = decoder.decode();

  if (remainingChunk) {
    fullContent += remainingChunk;
    onContent(remainingChunk);
  }

  return fullContent;
}
