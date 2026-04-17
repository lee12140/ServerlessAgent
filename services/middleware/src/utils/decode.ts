// Lambda errors surface as { errorMessage: "..." } instead of the real response shape.
export function decodeLambdaPayload<T>(payload: Uint8Array): T {
  const parsed = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
  if (parsed['errorMessage']) throw new Error(parsed['errorMessage'] as string);
  return parsed as T;
}
