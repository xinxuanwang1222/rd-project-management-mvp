"use server";

import type { BaseRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { defaultPermissionsForRole } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getRole(value: string): BaseRole {
  if (value === "OWNER" || value === "SYSTEM_ADMIN" || value === "RD_LEAD" || value === "RD_MEMBER") return value;
  return "RD_MEMBER";
}

export async function createUserAction(formData: FormData) {
  await requirePermission((user) => user.canManageUsers);
  const role = getRole(getString(formData, "role"));
  const defaults = defaultPermissionsForRole(role);
  const tempPassword = getString(formData, "tempPassword") || "Temp12345!";

  await prisma.user.create({
    data: {
      username: getString(formData, "username"),
      displayName: getString(formData, "displayName"),
      role,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      isActive: true,
      canApproveProjects: getBoolean(formData, "canApproveProjects") || defaults.canApproveProjects,
      canApproveTasks: getBoolean(formData, "canApproveTasks") || defaults.canApproveTasks,
      canManageUsers: getBoolean(formData, "canManageUsers") || defaults.canManageUsers,
      canManageAllProjects: getBoolean(formData, "canManageAllProjects") || defaults.canManageAllProjects,
      canManageFiles: getBoolean(formData, "canManageFiles") || defaults.canManageFiles
    }
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(formData: FormData) {
  const actor = await requirePermission((user) => user.canManageUsers);
  const id = getString(formData, "id");
  if (id === actor.id && !getBoolean(formData, "canManageUsers")) {
    redirect("/users?error=self-admin");
  }
  const role = getRole(getString(formData, "role"));
  await prisma.user.update({
    where: { id },
    data: {
      displayName: getString(formData, "displayName"),
      role,
      canApproveProjects: getBoolean(formData, "canApproveProjects"),
      canApproveTasks: getBoolean(formData, "canApproveTasks"),
      canManageUsers: getBoolean(formData, "canManageUsers"),
      canManageAllProjects: getBoolean(formData, "canManageAllProjects"),
      canManageFiles: getBoolean(formData, "canManageFiles")
    }
  });
  revalidatePath("/users");
}

export async function toggleUserAction(formData: FormData) {
  const actor = await requirePermission((user) => user.canManageUsers);
  const id = getString(formData, "id");
  if (id === actor.id) redirect("/users?error=self-disable");
  const isActive = getString(formData, "isActive") === "true";
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/users");
}

export async function resetPasswordAction(formData: FormData) {
  await requirePermission((user) => user.canManageUsers);
  const id = getString(formData, "id");
  const tempPassword = getString(formData, "tempPassword") || "Temp12345!";
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true
    }
  });
  revalidatePath("/users");
}
