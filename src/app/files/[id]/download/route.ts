import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id },
    include: {
      project: {
        include: { tasks: { select: { assigneeId: true } } }
      }
    }
  });
  if (!file) return new NextResponse("Not found", { status: 404 });
  const assigneeIds = file.project.tasks.map((task) => task.assigneeId);
  if (!canViewProject(user, file.project.ownerId, assigneeIds)) return new NextResponse("Forbidden", { status: 403 });

  const bytes = await readFile(file.storagePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": file.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    }
  });
}
