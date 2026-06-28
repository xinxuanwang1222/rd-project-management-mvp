"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function decideApprovalAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const decision = getString(formData, "decision");
  const request = await prisma.approvalRequest.findUnique({
    where: { id },
    include: { project: true, task: true }
  });
  if (!request || request.status !== "PENDING") redirect("/approvals");
  if (request.type === "PROJECT_INITIATION" && !user.canApproveProjects) redirect("/approvals");
  if (request.type === "TASK_COMPLETION" && !user.canApproveTasks) redirect("/approvals");

  const approved = decision === "APPROVED";
  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        approverId: user.id,
        decisionNote: getString(formData, "decisionNote") || null,
        decidedAt: new Date()
      }
    });

    if (request.type === "PROJECT_INITIATION" && request.projectId) {
      await tx.project.update({
        where: { id: request.projectId },
        data: { approvalStatus: approved ? "APPROVED" : "REJECTED", updatedAt: new Date() }
      });
    }

    if (request.type === "TASK_COMPLETION" && request.taskId && request.projectId) {
      await tx.task.update({
        where: { id: request.taskId },
        data: {
          status: approved ? "COMPLETED" : request.task?.status ?? "IN_PROGRESS",
          approvalStatus: approved ? "APPROVED" : "REJECTED"
        }
      });
      await tx.project.update({ where: { id: request.projectId }, data: { updatedAt: new Date() } });
    }
  });

  revalidatePath("/approvals");
  if (request.projectId) revalidatePath(`/projects/${request.projectId}`);
  revalidatePath("/");
}
