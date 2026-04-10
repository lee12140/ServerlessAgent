// Converts the raw binary Lambda response into a typed object.
// Lambda always returns its response as a Uint8Array — we need to:
//   1. Decode the bytes into a UTF-8 string
//   2. Parse the JSON string into an object
//   3. Check if Lambda itself threw an error (errorMessage field)
//   4. Return the object cast to the expected type T
export function decodeLambdaPayload<T>(payload: Uint8Array): T {
  // Step 1 + 2: decode bytes → string → object
  const parsed = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;

  // Step 3: if Lambda crashed, it returns { errorMessage: "..." } instead of the real response
  if (parsed['errorMessage']) {
    throw new Error(parsed['errorMessage'] as string);
  }

  // Step 4: safe to cast — we've ruled out the error case
  return parsed as T;
}
