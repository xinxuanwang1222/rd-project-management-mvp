import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { canManageProject, canWriteProjectNote, defaultPermissionsForRole } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function testPassword() {
  const hash = await hashPassword("Secret123!");
  assert.equal(await verifyPassword("Secret123!", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
}

function testPermissions() {
  const ownerDefaults = defaultPermissionsForRole("OWNER");
  assert.equal(ownerDefaults.canApproveProjects, true);
  assert.equal(ownerDefaults.canManageUsers, false);

  const adminDefaults = defaultPermissionsForRole("SYSTEM_ADMIN");
  assert.equal(adminDefaults.canManageUsers, true);
  assert.equal(adminDefaults.canApproveTasks, false);

  const user = {
    id: "u1",
    role: "RD_MEMBER" as const,
    isActive: true,
    canApproveProjects: false,
    canApproveTasks: false,
    canManageUsers: false,
    canManageAllProjects: false,
    canManageFiles: true
  };
  assert.equal(canManageProject(user, "u1"), true);
  assert.equal(canManageProject(user, "u2"), false);
  assert.equal(canWriteProjectNote(user, { ownerId: "u2", assigneeIds: ["u1"] }), true);
}

async function testApprovalFlows() {
  await prisma.project.deleteMany({ where: { name: { contains: "测试项目" } } });
  await prisma.approvalRequest.deleteMany({
    where: {
      OR: [
        { submittedBy: { username: { contains: "test-" } } },
        { approver: { username: { contains: "test-" } } }
      ]
    }
  });
  await prisma.user.deleteMany({ where: { username: { contains: "test-" } } });

  const suffix = Date.now().toString();
  const passwordHash = await hashPassword("Temp12345!");
  const approver = await prisma.user.create({
    data: {
      username: `test-approver-${suffix}`,
      displayName: "测试审批人",
      role: "OWNER",
      passwordHash,
      canApproveProjects: true,
      canApproveTasks: true,
      canManageAllProjects: true
    }
  });
  const lead = await prisma.user.create({
    data: {
      username: `test-lead-${suffix}`,
      displayName: "测试负责人",
      role: "RD_LEAD",
      passwordHash,
      canManageAllProjects: true,
      canManageFiles: true
    }
  });

  const project = await prisma.project.create({
    data: {
      name: `测试项目 ${suffix}`,
      ownerId: lead.id,
      createdById: lead.id,
      approvalStatus: "PENDING",
      approvals: {
        create: {
          type: "PROJECT_INITIATION",
          submittedById: lead.id,
          requestNote: "测试立项"
        }
      }
    },
    include: { approvals: true }
  });
  assert.equal(project.approvalStatus, "PENDING");

  await prisma.$transaction([
    prisma.approvalRequest.update({
      where: { id: project.approvals[0].id },
      data: { status: "APPROVED", approverId: approver.id, decidedAt: new Date() }
    }),
    prisma.project.update({ where: { id: project.id }, data: { approvalStatus: "APPROVED" } })
  ]);
  const approvedProject = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
  assert.equal(approvedProject.approvalStatus, "APPROVED");

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "测试任务完成审批",
      assigneeId: lead.id,
      createdById: lead.id,
      status: "IN_PROGRESS",
      approvalStatus: "PENDING",
      approvals: {
        create: {
          type: "TASK_COMPLETION",
          projectId: project.id,
          submittedById: lead.id,
          requestNote: "测试完成"
        }
      }
    },
    include: { approvals: true }
  });

  await prisma.$transaction([
    prisma.approvalRequest.update({
      where: { id: task.approvals[0].id },
      data: { status: "APPROVED", approverId: approver.id, decidedAt: new Date() }
    }),
    prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED", approvalStatus: "APPROVED" } })
  ]);
  const approvedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(approvedTask.status, "COMPLETED");
  assert.equal(approvedTask.approvalStatus, "APPROVED");

  await prisma.project.deleteMany({ where: { id: project.id } });
  await prisma.approvalRequest.deleteMany({
    where: {
      OR: [{ submittedById: { in: [approver.id, lead.id] } }, { approverId: { in: [approver.id, lead.id] } }]
    }
  });
  await prisma.user.deleteMany({ where: { id: { in: [approver.id, lead.id] } } });
}

async function main() {
  await testPassword();
  testPermissions();
  await testApprovalFlows();
  console.log("All tests passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
