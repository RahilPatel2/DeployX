import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const PREFIX = "enc:v1:";

/**
 * Derives a stable 256-bit encryption key.
 * Prioritizes ENCRYPTION_KEY if configured in environment, otherwise
 * derives a cryptographically isolated key from JWT_SECRET.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY?.trim();
  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    return crypto.createHash("sha256").update(envKey).digest();
  }

  const baseSecret = process.env.JWT_SECRET || "default_development_secret_key";
  return crypto.createHash("sha256").update(baseSecret + ":deployx_token_encryption").digest();
}

/**
 * Encrypts a sensitive string (such as an OAuth access token) using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return plainText;
  if (plainText.startsWith(PREFIX)) return plainText; // Idempotent check

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * If the input is unencrypted (legacy token), passes it through safely.
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return cipherText;
  if (!cipherText.startsWith(PREFIX)) {
    // Backward compatibility for existing plaintext tokens
    return cipherText;
  }

  try {
    const parts = cipherText.substring(PREFIX.length).split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted token format");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Token decryption failed:", error);
    throw new Error("Failed to decrypt access token");
  }
}
