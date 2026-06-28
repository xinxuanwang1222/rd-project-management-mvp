import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "rdpm_session";

function getSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = JSON.stringify({
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      userId: string;
      expiresAt: number;
    };
    if (payload.expiresAt < Date.now()) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function requireUserAllowingPasswordChange() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(predicate: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => boolean) {
  const user = await requireUser();
  if (!predicate(user)) redirect("/");
  return user;
}
