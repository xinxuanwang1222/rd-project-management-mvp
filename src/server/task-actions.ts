"use server";

import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function getTaskStatus(value: string): TaskStatus {
  const allowed: TaskStatus[] = ["TODO", "IN_PROGRESS", "PAUSED", "COMPLETED"];
  return allowed.includes(value as TaskStatus) ? (value as TaskStatus) : "TODO";
}

async function getProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: { select: { assigneeId: true } } }
  });
  if (!project) return null;
  const isParticipant = project.ownerId === userId || project.tasks.some((task) => task.assigneeId === userId);
  return { project, isParticipant };
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  const projectId = getString(formData, "projectId");
  const access = await getProjectAccess(projectId, user.id);
  if (!access || !canManageProject(user, access.project.ownerId)) redirect(`/projects/${projectId}`);

  await prisma.$transaction([
    prisma.task.create({
      data: {
        projectId,
        title: getString(formData, "title"),
        assigneeId: getString(formData, "assigneeId"),
        dueDate: optionalDate(getString(formData, "dueDate")),
        status: getTaskStatus(getString(formData, "status")),
        note: getString(formData, "note") || null,
        createdById: user.id
      }
    }),
    prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } })
  ]);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTaskAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!task) redirect("/");
  const canEdit = canManageProject(user, task.project.ownerId) || task.assigneeId === user.id;
  if (!canEdit) redirect(`/projects/${task.projectId}`);

  const nextStatus = getTaskStatus(getString(formData, "status"));
  if (nextStatus === "COMPLETED" && task.status !== "COMPLETED") {
    await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: {
          title: getString(formData, "title") || task.title,
          assigneeId: getString(formData, "assigneeId") || task.assigneeId,
          dueDate: optionalDate(getString(formData, "dueDate")),
          note: getString(formData, "note") || null,
          approvalStatus: "PENDING"
        }
      }),
      prisma.approvalRequest.create({
        data: {
          type: "TASK_COMPLETION",
          projectId: task.projectId,
          taskId: task.id,
          submittedById: user.id,
          requestNote: getString(formData, "requestNote") || "申请任务完成审批"
        }
      }),
      prisma.project.update({ where: { id: task.projectId }, data: { updatedAt: new Date() } })
    ]);
  } else {
    await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: {
          title: getString(formData, "title") || task.title,
          assigneeId: getString(formData, "assigneeId") || task.assigneeId,
          dueDate: optionalDate(getString(formData, "dueDate")),
          status: nextStatus,
          approvalStatus: nextStatus === "COMPLETED" ? "APPROVED" : "NONE",
          note: getString(formData, "note") || null
        }
      }),
      prisma.project.update({ where: { id: task.projectId }, data: { updatedAt: new Date() } })
    ]);
  }
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/approvals");
}
