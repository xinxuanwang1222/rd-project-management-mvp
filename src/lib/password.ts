import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, storedHex] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const key = (await scrypt(password, salt, stored.length)) as Buffer;
  return stored.length === key.length && timingSafeEqual(stored, key);
}
