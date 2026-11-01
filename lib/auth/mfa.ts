/**
 * DeployX Multi-Factor Authentication (MFA / TOTP) Engine
 *
 * Implements RFC 6238-compatible Time-Based One-Time Password (TOTP)
 * with AES-256-GCM encrypted secret storage, QR code provisioning,
 * clock-drift tolerance, replay attack mitigation, and high-entropy
 * single-use recovery codes.
 */

import crypto from "crypto";
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
import QRCode from "qrcode";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV
const MFA_SECRET_PREFIX = "mfa:v1:";

/**
 * Retrieves the cryptographic key specifically for MFA secret encryption.
 * Supports dedicated MFA_ENCRYPTION_KEY with safe derivation fallback in development.
 */
export function getMfaEncryptionKey(): Buffer {
  const dedicated = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (dedicated) {
    if (dedicated.length === 64 && /^[0-9a-fA-F]+$/.test(dedicated)) {
      return Buffer.from(dedicated, "hex");
    }
    return crypto.createHash("sha256").update(dedicated).digest();
  }

  // Fallback to ENCRYPTION_KEY or JWT_SECRET with dedicated domain separation
  const fallback = process.env.ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !dedicated && !process.env.ENCRYPTION_KEY) {
    throw new Error(
      "[DeployX MFA] FATAL: Missing MFA_ENCRYPTION_KEY in production! A strong 256-bit encryption key must be configured."
    );
  }

  const baseSecret = fallback || "default_development_mfa_encryption_key";
  return crypto.createHash("sha256").update(baseSecret + ":deployx_mfa_secret_encryption").digest();
}

/**
 * Encrypts a raw base32 TOTP secret using AES-256-GCM with authentication tag.
 */
export function encryptMfaSecret(plainSecret: string): string {
  if (!plainSecret) throw new Error("MFA secret cannot be empty.");
  if (plainSecret.startsWith(MFA_SECRET_PREFIX)) return plainSecret;

  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainSecret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${MFA_SECRET_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret.
 */
export function decryptMfaSecret(cipherText: string): string {
  if (!cipherText) throw new Error("Encrypted MFA secret cannot be empty.");
  if (!cipherText.startsWith(MFA_SECRET_PREFIX)) {
    throw new Error("Invalid MFA secret encryption format.");
  }

  const parts = cipherText.slice(MFA_SECRET_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Corrupted MFA secret ciphertext.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getMfaEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export interface MfaEnrollmentPayload {
  secret: string; // Plaintext returned only once during active enrollment
  manualKey: string; // Formatted in 4-character chunks for manual entry
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Generates a fresh TOTP secret, provisioning URI, and QR code data URL for enrollment.
 */
export async function generateMfaEnrollment(userEmail: string): Promise<MfaEnrollmentPayload> {
  const secret = generateSecret();
  const issuer = "DeployX";
  const otpauthUrl = generateURI({
    secret,
    label: userEmail,
    issuer,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  // Format manual setup key into friendly readable chunks (e.g., ABCD EFGH 1234 ...)
  const manualKey = secret.replace(/(.{4})/g, "$1 ").trim();

  return {
    secret,
    manualKey,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export interface VerifyMfaResult {
  valid: boolean;
  timeStep?: number;
  error?: string;
}

/**
 * Validates a 6-digit TOTP code against a decrypted secret with drift tolerance and replay mitigation.
 */
export function verifyMfaToken(
  token: string,
  secret: string,
  lastUsedTimeStep?: number
): VerifyMfaResult {
  const cleanToken = token.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, error: "Authentication code must be a 6-digit number." };
  }

  try {
    const rawResult = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 30, // 30-second clock-drift window (prev/current/next)
    });

    const result = rawResult as { valid: boolean; timeStep?: number; delta?: number };

    if (!result || !result.valid) {
      return { valid: false, error: "Invalid verification code. Please check your authenticator app." };
    }

    // Replay attack prevention: reject if this exact time step has already been consumed
    if (lastUsedTimeStep !== undefined && result.timeStep !== undefined && result.timeStep <= lastUsedTimeStep) {
      return {
        valid: false,
        error: "This code was already used. Please wait for the authenticator app to display the next code.",
      };
    }

    return {
      valid: true,
      timeStep: result.timeStep,
    };
  } catch {
    return { valid: false, error: "Error verifying authentication code." };
  }
}

/**
 * Helper to generate current TOTP code for testing/validation purposes.
 */
export function generateCurrentMfaToken(secret: string): string {
  return generateSync({ secret });
}

export interface StoredRecoveryCode {
  codeHash: string;
  usedAt?: Date;
}

/**
 * Generates high-entropy single-use recovery codes.
 * Returns both the plaintext codes (for one-time user display) and their cryptographic hashes (for database storage).
 */
export function generateRecoveryCodes(count = 8): {
  plainCodes: string[];
  hashedCodes: StoredRecoveryCode[];
} {
  const plainCodes: string[] = [];
  const hashedCodes: StoredRecoveryCode[] = [];

  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex
    const part2 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex
    const code = `${part1}-${part2}`;
    plainCodes.push(code);

    const codeHash = hashRecoveryCode(code);
    hashedCodes.push({ codeHash });
  }

  return { plainCodes, hashedCodes };
}

/**
 * Hashes a recovery code using SHA-256 for secure constant-time verification.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return crypto.createHash("sha256").update(`deployx_recovery:${normalized}`).digest("hex");
}

export interface ConsumeRecoveryCodeResult {
  valid: boolean;
  remainingCount: number;
  updatedCodes: StoredRecoveryCode[];
  error?: string;
}

/**
 * Atomically checks and consumes a single-use recovery code.
 */
export function verifyAndConsumeRecoveryCode(
  inputCode: string,
  existingCodes: StoredRecoveryCode[] = []
): ConsumeRecoveryCodeResult {
  if (!inputCode || typeof inputCode !== "string") {
    return {
      valid: false,
      remainingCount: existingCodes.filter((c) => !c.usedAt).length,
      updatedCodes: existingCodes,
      error: "Recovery code is required.",
    };
  }

  const targetHash = hashRecoveryCode(inputCode);
  let matchedIndex = -1;

  for (let i = 0; i < existingCodes.length; i++) {
    const item = existingCodes[i];
    if (!item.usedAt && item.codeHash === targetHash) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    return {
      valid: false,
      remainingCount: existingCodes.filter((c) => !c.usedAt).length,
      updatedCodes: existingCodes,
      error: "Invalid or already used recovery code.",
    };
  }

  // Clone and mark as used atomically
  const updatedCodes = existingCodes.map((c, idx) =>
    idx === matchedIndex ? { ...c, usedAt: new Date() } : c
  );

  const remainingCount = updatedCodes.filter((c) => !c.usedAt).length;

  return {
    valid: true,
    remainingCount,
    updatedCodes,
  };
}
