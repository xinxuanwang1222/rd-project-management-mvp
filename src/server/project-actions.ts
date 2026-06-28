"use server";

import type { FileType, NoteType, ProjectStatus } from "@prisma/client";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageFile, canManageProject, canWriteProjectNote } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function getProjectStatus(value: string): ProjectStatus {
  const allowed: ProjectStatus[] = ["NOT_STARTED", "IN_PROGRESS", "SAMPLING", "TESTING", "COMPLETED", "PAUSED"];
  return allowed.includes(value as ProjectStatus) ? (value as ProjectStatus) : "NOT_STARTED";
}

function getFileType(value: string): FileType {
  const allowed: FileType[] = ["DRAWING", "BOM", "QUOTE", "TEST_RECORD", "PHOTO", "CUSTOMER_REQUIREMENT", "OTHER"];
  return allowed.includes(value as FileType) ? (value as FileType) : "OTHER";
}

function getNoteType(value: string): NoteType {
  const allowed: NoteType[] = ["PROGRESS", "RISK", "DECISION", "GENERAL"];
  return allowed.includes(value as NoteType) ? (value as NoteType) : "PROGRESS";
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "RD_LEAD") redirect("/");
  const ownerId = getString(formData, "ownerId") || user.id;
  const project = await prisma.project.create({
    data: {
      name: getString(formData, "name"),
      clientName: getString(formData, "clientName") || null,
      productName: getString(formData, "productName") || null,
      ownerId,
      createdById: user.id,
      status: getProjectStatus(getString(formData, "status")),
      approvalStatus: "PENDING",
      startDate: optionalDate(getString(formData, "startDate")),
      note: getString(formData, "note") || null
    }
  });
  await prisma.approvalRequest.create({
    data: {
      type: "PROJECT_INITIATION",
      projectId: project.id,
      submittedById: user.id,
      requestNote: "申请项目立项"
    }
  });
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !canManageProject(user, project.ownerId)) redirect("/");

  await prisma.project.update({
    where: { id },
    data: {
      name: getString(formData, "name"),
      clientName: getString(formData, "clientName") || null,
      productName: getString(formData, "productName") || null,
      ownerId: getString(formData, "ownerId") || project.ownerId,
      status: getProjectStatus(getString(formData, "status")),
      startDate: optionalDate(getString(formData, "startDate")),
      note: getString(formData, "note") || null
    }
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function resubmitProjectAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !canManageProject(user, project.ownerId)) redirect("/");

  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { approvalStatus: "PENDING" } }),
    prisma.approvalRequest.create({
      data: {
        type: "PROJECT_INITIATION",
        projectId: id,
        submittedById: user.id,
        requestNote: getString(formData, "requestNote") || "重新提交项目立项"
      }
    })
  ]);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/approvals");
}

export async function addProjectNoteAction(formData: FormData) {
  const user = await requireUser();
  const projectId = getString(formData, "projectId");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: { select: { assigneeId: true } } }
  });
  if (!project) redirect("/");
  if (!canWriteProjectNote(user, { ownerId: project.ownerId, assigneeIds: project.tasks.map((task) => task.assigneeId) })) {
    redirect(`/projects/${projectId}`);
  }
  await prisma.projectNote.create({
    data: {
      projectId,
      authorId: user.id,
      type: getNoteType(getString(formData, "type")),
      content: getString(formData, "content")
    }
  });
  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectNoteAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const note = await prisma.projectNote.findUnique({ where: { id } });
  if (!note || note.authorId !== user.id) redirect("/");
  await prisma.projectNote.delete({ where: { id } });
  revalidatePath(`/projects/${note.projectId}`);
}

export async function uploadProjectFileAction(formData: FormData) {
  const user = await requireUser();
  const projectId = getString(formData, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !canManageFile(user, project.ownerId)) redirect("/");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/projects/${projectId}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "storage", "uploads", projectId);
  await mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storagePath = path.join(uploadDir, safeName);
  await writeFile(storagePath, bytes);

  await prisma.$transaction([
    prisma.projectFile.create({
      data: {
        projectId,
        fileName: getString(formData, "fileName") || file.name,
        originalName: file.name,
        fileType: getFileType(getString(formData, "fileType")),
        storagePath,
        mimeType: file.type || null,
        sizeBytes: file.size,
        uploadedById: user.id,
        note: getString(formData, "note") || null
      }
    }),
    prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } })
  ]);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectFileAction(formData: FormData) {
  const user = await requireUser();
  const id = getString(formData, "id");
  const record = await prisma.projectFile.findUnique({ where: { id }, include: { project: true } });
  if (!record || !canManageFile(user, record.project.ownerId)) redirect("/");
  await prisma.projectFile.delete({ where: { id } });
  await unlink(record.storagePath).catch(() => undefined);
  revalidatePath(`/projects/${record.projectId}`);
}
