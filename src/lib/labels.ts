import type {
  ApprovalStatus,
  ApprovalType,
  BaseRole,
  FileType,
  NoteType,
  ProjectApprovalStatus,
  ProjectStatus,
  TaskApprovalStatus,
  TaskStatus
} from "@prisma/client";

export const roleLabels: Record<BaseRole, string> = {
  OWNER: "老板/审批人",
  SYSTEM_ADMIN: "系统管理员",
  RD_LEAD: "研发负责人",
  RD_MEMBER: "研发员工"
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  NOT_STARTED: "未开始",
  IN_PROGRESS: "进行中",
  SAMPLING: "打样中",
  TESTING: "测试中",
  COMPLETED: "已完成",
  PAUSED: "暂停"
};

export const projectApprovalLabels: Record<ProjectApprovalStatus, string> = {
  PENDING: "待立项审批",
  APPROVED: "已立项",
  REJECTED: "立项被拒"
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "待处理",
  IN_PROGRESS: "进行中",
  PAUSED: "暂停",
  COMPLETED: "已完成"
};

export const taskApprovalLabels: Record<TaskApprovalStatus, string> = {
  NONE: "无需审批",
  PENDING: "完成待审批",
  APPROVED: "完成已通过",
  REJECTED: "完成被拒"
};

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已拒绝"
};

export const approvalTypeLabels: Record<ApprovalType, string> = {
  PROJECT_INITIATION: "项目立项",
  TASK_COMPLETION: "任务完成"
};

export const fileTypeLabels: Record<FileType, string> = {
  DRAWING: "图纸",
  BOM: "BOM",
  QUOTE: "报价单",
  TEST_RECORD: "测试记录",
  PHOTO: "照片",
  CUSTOMER_REQUIREMENT: "客户需求",
  OTHER: "其他"
};

export const noteTypeLabels: Record<NoteType, string> = {
  PROGRESS: "进度",
  RISK: "风险",
  DECISION: "决策",
  GENERAL: "备注"
};

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
