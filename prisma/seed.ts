import { PrismaClient, type BaseRole, type FileType, type ProjectStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function upsertUser(input: {
  username: string;
  displayName: string;
  role: BaseRole;
  password: string;
  mustChangePassword?: boolean;
  canApproveProjects?: boolean;
  canApproveTasks?: boolean;
  canManageUsers?: boolean;
  canManageAllProjects?: boolean;
  canManageFiles?: boolean;
}) {
  return prisma.user.upsert({
    where: { username: input.username },
    update: {
      displayName: input.displayName,
      role: input.role,
      isActive: true,
      canApproveProjects: input.canApproveProjects ?? false,
      canApproveTasks: input.canApproveTasks ?? false,
      canManageUsers: input.canManageUsers ?? false,
      canManageAllProjects: input.canManageAllProjects ?? false,
      canManageFiles: input.canManageFiles ?? false
    },
    create: {
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: input.mustChangePassword ?? false,
      canApproveProjects: input.canApproveProjects ?? false,
      canApproveTasks: input.canApproveTasks ?? false,
      canManageUsers: input.canManageUsers ?? false,
      canManageAllProjects: input.canManageAllProjects ?? false,
      canManageFiles: input.canManageFiles ?? false
    }
  });
}

async function main() {
  const owner = await upsertUser({
    username: "owner",
    displayName: "老板审批人",
    role: "OWNER",
    password: "Owner123!",
    canApproveProjects: true,
    canApproveTasks: true,
    canManageAllProjects: true,
    canManageFiles: true
  });

  await upsertUser({
    username: "admin",
    displayName: "系统管理员",
    role: "SYSTEM_ADMIN",
    password: "Admin123!",
    canManageUsers: true
  });

  const lead = await upsertUser({
    username: "lead",
    displayName: "研发负责人",
    role: "RD_LEAD",
    password: "Lead123!",
    canManageAllProjects: true,
    canManageFiles: true
  });

  const member = await upsertUser({
    username: "member",
    displayName: "研发员工",
    role: "RD_MEMBER",
    password: "Member123!",
    canManageFiles: true
  });

  const existing = await prisma.project.findFirst({ where: { name: "样品结构优化项目" } });
  if (!existing) {
    const project = await prisma.project.create({
      data: {
        name: "样品结构优化项目",
        clientName: "华南客户",
        productName: "便携式检测仪外壳",
        ownerId: lead.id,
        createdById: lead.id,
        status: "IN_PROGRESS" satisfies ProjectStatus,
        approvalStatus: "APPROVED",
        startDate: new Date("2026-06-24T00:00:00.000Z"),
        note: "客户要求优化尺寸和材料，当前正在确认第一版打样方案。",
        notes: {
          create: [
            {
              authorId: lead.id,
              type: "PROGRESS",
              content: "已整理客户需求和第一版结构草图，等待打样材料确认。"
            },
            {
              authorId: owner.id,
              type: "DECISION",
              content: "优先保证测试样件交付时间，外观细节放到第二轮优化。"
            }
          ]
        },
        tasks: {
          create: [
            {
              title: "完成第一版 BOM 表",
              assigneeId: member.id,
              createdById: lead.id,
              status: "IN_PROGRESS",
              dueDate: new Date("2026-06-30T00:00:00.000Z"),
              note: "需要补充关键物料供应商和预计单价。"
            },
            {
              title: "联系客户确认尺寸公差",
              assigneeId: lead.id,
              createdById: lead.id,
              status: "TODO",
              dueDate: new Date("2026-07-02T00:00:00.000Z")
            }
          ]
        }
      }
    });

    await prisma.projectFile.create({
      data: {
        projectId: project.id,
        fileName: "demo-customer-requirement.txt",
        originalName: "客户需求说明.txt",
        fileType: "CUSTOMER_REQUIREMENT" satisfies FileType,
        storagePath: "storage/uploads/demo-customer-requirement.txt",
        mimeType: "text/plain",
        sizeBytes: 42,
        uploadedById: lead.id,
        note: "演示用文件记录，真实上传会保存到项目目录。"
      }
    });
  }

  console.log("Seed complete. Demo accounts:");
  console.log("owner / Owner123! - 审批人");
  console.log("admin / Admin123! - 系统管理员");
  console.log("lead / Lead123! - 研发负责人");
  console.log("member / Member123! - 研发员工");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
