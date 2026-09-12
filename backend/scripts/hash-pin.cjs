// One-off helper: computes a PBKDF2-SHA256/210k hash identical to src/core/pin.ts's Web Crypto
// implementation (Node's crypto.pbkdf2Sync and WebCrypto's deriveBits produce byte-identical
// output for the same inputs), so these values verify correctly against the deployed Worker.
const crypto = require("crypto");

const pin = process.argv[2];
if (!pin) {
  console.error("Usage: node hash-pin.cjs <pin>");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(pin, salt, 100_000, 32, "sha256");

console.log(JSON.stringify({ pin, hash: hash.toString("hex"), salt: salt.toString("hex") }));
