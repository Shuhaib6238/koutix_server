/**
 * @file AES-256-GCM encryption/decryption for payment gateway secrets.
 * Key from ENCRYPTION_KEY env var (32-byte hex string = 64 hex chars).
 */
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key buffer from env.
 * @returns {Buffer}
 */
function getKey() {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey || hexKey.length < 32) {
    throw new Error("ENCRYPTION_KEY env var must be at least 32 characters");
  }
  // Use first 32 bytes (if hex, decode; otherwise use raw)
  if (/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    return Buffer.from(hexKey, "hex");
  }
  // Fallback: use SHA-256 hash of the key string
  return crypto.createHash("sha256").update(hexKey).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a combined string: iv:authTag:ciphertext (all hex).
 * @param {string} plaintext
 * @returns {string} Encrypted string
 */
function encrypt(plaintext) {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string encrypted by the encrypt() function.
 * @param {string} encryptedStr - Format: iv:authTag:ciphertext (hex)
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedStr) {
  if (!encryptedStr) return "";
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt };
