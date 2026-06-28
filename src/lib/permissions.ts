import type { BaseRole, User } from "@prisma/client";

export type PermissionUser = Pick<
  User,
  | "id"
  | "role"
  | "isActive"
  | "canApproveProjects"
  | "canApproveTasks"
  | "canManageUsers"
  | "canManageAllProjects"
  | "canManageFiles"
>;

export function defaultPermissionsForRole(role: BaseRole) {
  return {
    canApproveProjects: role === "OWNER",
    canApproveTasks: role === "OWNER",
    canManageUsers: role === "SYSTEM_ADMIN",
    canManageAllProjects: role === "OWNER" || role === "RD_LEAD",
    canManageFiles: role === "OWNER" || role === "RD_LEAD" || role === "RD_MEMBER"
  };
}

export function canManageProject(user: PermissionUser, ownerId?: string) {
  return user.isActive && (user.canManageAllProjects || user.id === ownerId);
}

export function canViewProject(user: PermissionUser, ownerId?: string, assigneeIds: string[] = []) {
  return user.isActive && (user.canManageAllProjects || user.id === ownerId || assigneeIds.includes(user.id));
}

export function canWriteProjectNote(user: PermissionUser, input: { ownerId: string; assigneeIds: string[] }) {
  if (!user.isActive) return false;
  if (user.canApproveProjects || user.canApproveTasks) return true;
  if (user.canManageAllProjects || user.id === input.ownerId) return true;
  return input.assigneeIds.includes(user.id);
}

export function canManageFile(user: PermissionUser, projectOwnerId: string) {
  return user.isActive && (user.canManageFiles || user.canManageAllProjects || user.id === projectOwnerId);
}
