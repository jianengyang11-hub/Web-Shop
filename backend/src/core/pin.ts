/** PBKDF2-SHA256 PIN/password hashing via Web Crypto — no native bcrypt/argon2 addon is
 * available in the Workers runtime, and Web Crypto's PBKDF2 is implemented natively so it's
 * fast enough there even at a healthy iteration count. */

// Cloudflare Workers' WebCrypto PBKDF2 caps out at 100,000 iterations (unlike Node/browsers,
// which allow much higher) — this is the max usable here.
const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return toHex(bits);
}

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, saltBytes);
  return { hash, salt: toHex(saltBytes.buffer as ArrayBuffer) };
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  const actualHash = await derive(pin, fromHex(salt));
  if (actualHash.length !== expectedHash.length) return false;
  // Constant-time-ish comparison to avoid trivial timing leaks on hash length/content.
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}
