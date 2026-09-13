/** Generates a human-typeable backup code for the "forgot PIN" flow — no third-party
 * email/SMS provider involved. Alphabet excludes visually ambiguous characters (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 10;

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}
