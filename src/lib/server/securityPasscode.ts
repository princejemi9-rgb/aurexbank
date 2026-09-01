import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const PASSCODE_METADATA_KEY = "aurex_security_passcode";
const SCRYPT_COST = 16384;

export type SecurityPasscodeRecord = {
  hash: string;
  salt: string;
  revision: string;
  configuredAt: string;
};

export function readSecurityPasscode(value: unknown): SecurityPasscodeRecord | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<SecurityPasscodeRecord>;
  return typeof record.hash === "string" &&
    typeof record.salt === "string" &&
    typeof record.revision === "string"
    ? (record as SecurityPasscodeRecord)
    : null;
}

function derive(passcode: string, salt: string) {
  return scryptSync(passcode, Buffer.from(salt, "base64url"), 32, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
  });
}

export function createSecurityPasscode(passcode: string): SecurityPasscodeRecord {
  const salt = randomBytes(16).toString("base64url");
  return {
    salt,
    hash: derive(passcode, salt).toString("base64url"),
    revision: randomBytes(16).toString("base64url"),
    configuredAt: new Date().toISOString(),
  };
}

export function verifySecurityPasscode(passcode: string, record: SecurityPasscodeRecord) {
  const expected = Buffer.from(record.hash, "base64url");
  const actual = derive(passcode, record.salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}


export function validatePasscodeInput(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 128;
}
