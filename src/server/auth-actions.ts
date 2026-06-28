"use server";

import { redirect } from "next/navigation";
import { clearSession, requireUserAllowingPasswordChange, setSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function loginAction(formData: FormData) {
  const username = getString(formData, "username");
  const password = getString(formData, "password");
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  await setSession(user.id);
  redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUserAllowingPasswordChange();
  const currentPassword = getString(formData, "currentPassword");
  const newPassword = getString(formData, "newPassword");
  const confirmPassword = getString(formData, "confirmPassword");

  if (newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect("/change-password?error=invalid");
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    redirect("/change-password?error=current");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false
    }
  });
  redirect("/");
}
