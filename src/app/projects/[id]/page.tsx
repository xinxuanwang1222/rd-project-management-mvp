import Link from "next/link";
import { Badge, approvalTone } from "@/components/badge";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import {
  fileTypeLabels,
  formatDate,
  formatDateTime,
  projectApprovalLabels,
  projectStatusLabels,
  taskApprovalLabels,
  taskStatusLabels
} from "@/lib/labels";
import { canManageFile, canManageProject, canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decideApprovalAction } from "@/server/approval-actions";
import { deleteProjectFileAction, resubmitProjectAction, uploadProjectFileAction } from "@/server/project-actions";
import { createTaskAction, updateTaskAction } from "@/server/task-actions";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [project, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        owner: true,
        createdBy: true,
        files: { include: { uploadedBy: true, task: true }, orderBy: { createdAt: "desc" } },
        tasks: {
          include: {
            assignee: true,
            createdBy: true,
            files: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } }
          },
          orderBy: { updatedAt: "desc" }
        },
        approvals: { include: { submittedBy: true, approver: true }, orderBy: { createdAt: "desc" } }
      }
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } })
  ]);

  if (!project) {
    return (
      <AppShell user={user}>
        <div className="empty">项目不存在。</div>
      </AppShell>
    );
  }

  const assigneeIds = project.tasks.map((task) => task.assigneeId);
  if (!canViewProject(user, project.ownerId, assigneeIds)) {
    return (
      <AppShell user={user}>
        <div className="empty">你没有权限查看这个项目。</div>
      </AppShell>
    );
  }

  const canEditProject = canManageProject(user, project.ownerId);
  const canFiles = canManageFile(user, project.ownerId);
  const pendingProjectApproval = project.approvals.find(
    (approval) => approval.type === "PROJECT_INITIATION" && approval.status === "PENDING"
  );

  return (
    <AppShell user={user}>
      <div className="header-row project-title">
        <div>
          <div className="inline-actions">
            <h1>{project.name}</h1>
            <Badge>{projectStatusLabels[project.status]}</Badge>
            <Badge tone={approvalTone(project.approvalStatus)}>{projectApprovalLabels[project.approvalStatus]}</Badge>
          </div>
          <div className="project-summary">
            <span>客户：{project.clientName || "未填写"}</span>
            <span>产品：{project.productName || "未填写"}</span>
            <span>负责人：{project.owner.displayName}</span>
            <span>开始：{formatDate(project.startDate)}</span>
            <span>更新：{formatDateTime(project.updatedAt)}</span>
          </div>
          {project.note && <p className="project-note">{project.note}</p>}
        </div>
        <div className="inline-actions">
          {canEditProject && (
            <Link className="button secondary" href={`/projects/${project.id}/edit`}>
              编辑项目
            </Link>
          )}
          <Link className="button secondary" href="/">
            返回列表
          </Link>
        </div>
      </div>

      {(project.approvalStatus === "REJECTED" || (pendingProjectApproval && user.canApproveProjects)) && (
        <section className="approval-strip">
          {project.approvalStatus === "REJECTED" && canEditProject && (
            <form className="inline-form" action={resubmitProjectAction}>
              <input type="hidden" name="id" value={project.id} />
              <input name="requestNote" placeholder="重新提交说明" />
              <button type="submit">重新提交立项</button>
            </form>
          )}
          {pendingProjectApproval && user.canApproveProjects && (
            <form className="inline-form" action={decideApprovalAction}>
              <input type="hidden" name="id" value={pendingProjectApproval.id} />
              <input name="decisionNote" placeholder="立项审批意见" />
              <button name="decision" value="APPROVED" type="submit">
                通过立项
              </button>
              <button className="danger" name="decision" value="REJECTED" type="submit">
                拒绝
              </button>
            </form>
          )}
        </section>
      )}

      <div className="task-layout">
        <section className="task-main">
          <div className="section-heading">
            <div>
              <h2>任务</h2>
              <p className="subtle">项目推进以任务为主线，文件从具体任务中上传并归档。</p>
            </div>
            <Badge>{project.tasks.length} 个任务</Badge>
          </div>

          {canEditProject && (
            <section className="panel create-task-panel">
              <div className="panel-head">
                <h2>创建任务</h2>
              </div>
              <form className="panel-body form-grid" action={createTaskAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <div className="field">
                  <label>任务标题</label>
                  <input name="title" required />
                </div>
                <div className="field">
                  <label>负责人</label>
                  <select name="assigneeId" required>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>截止时间</label>
                  <input name="dueDate" type="date" />
                </div>
                <div className="field">
                  <label>备注</label>
                  <input name="note" />
                </div>
                <input type="hidden" name="status" value="TODO" />
                <button type="submit">创建任务</button>
              </form>
            </section>
          )}

          <div className="task-list">
            {project.tasks.map((task) => {
              const canEditTask = canEditProject || task.assigneeId === user.id;
              return (
                <article className="task-card" key={task.id}>
                  <div className="task-card-head">
                    <div>
                      <h3>{task.title}</h3>
                      <div className="inline-actions">
                        <Badge>{taskStatusLabels[task.status]}</Badge>
                        <Badge tone={approvalTone(task.approvalStatus === "NONE" ? "APPROVED" : task.approvalStatus)}>
                          {taskApprovalLabels[task.approvalStatus]}
                        </Badge>
                      </div>
                    </div>
                    <div className="task-meta">
                      <span>负责人：{task.assignee.displayName}</span>
                      <span>截止：{formatDate(task.dueDate)}</span>
                    </div>
                  </div>

                  {task.note && <p className="task-note">{task.note}</p>}

                  <div className="task-body-grid">
                    {canEditTask && (
                      <form className="task-status-form" action={updateTaskAction}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="title" value={task.title} />
                        <input type="hidden" name="assigneeId" value={task.assigneeId} />
                        <input type="hidden" name="dueDate" value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""} />
                        <input type="hidden" name="note" value={task.note ?? ""} />
                        <div className="field">
                          <label>任务状态</label>
                          <select name="status" defaultValue={task.status}>
                            {Object.entries(taskStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>完成说明</label>
                          <input name="requestNote" placeholder="提交已完成时进入审批" />
                        </div>
                        <button type="submit">保存状态</button>
                      </form>
                    )}

                    {canFiles && (
                      <form className="task-upload-form" action={uploadProjectFileAction}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <div className="field">
                          <label>上传任务文件</label>
                          <input name="file" type="file" required />
                        </div>
                        <div className="field">
                          <label>文件类型</label>
                          <select name="fileType" defaultValue="OTHER">
                            {Object.entries(fileTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input name="fileName" placeholder="显示名称，可不填" />
                        <input name="note" placeholder="文件备注" />
                        <button type="submit">上传到任务</button>
                      </form>
                    )}
                  </div>

                  {task.files.length > 0 && (
                    <div className="task-files">
                      {task.files.map((file) => (
                        <Link key={file.id} href={`/files/${file.id}/download`}>
                          {file.fileName}
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {project.tasks.length === 0 && <div className="empty">暂无任务。</div>}
          </div>
        </section>

        <aside className="file-sidebar">
          <div className="panel">
            <div className="panel-head">
              <h2>文件列表</h2>
              <span className="subtle">{project.files.length} 个</span>
            </div>
            <div className="panel-body stack">
              {project.files.map((file) => (
                <div className="file-row" key={file.id}>
                  <div>
                    <Link href={`/files/${file.id}/download`}>
                      <strong>{file.fileName}</strong>
                    </Link>
                    <div className="subtle">
                      {fileTypeLabels[file.fileType]} · {file.uploadedBy.displayName}
                    </div>
                    <div className="subtle">{file.task ? `任务：${file.task.title}` : "项目文件"}</div>
                    <div className="subtle">{formatDateTime(file.createdAt)}</div>
                  </div>
                  {canFiles && (
                    <form action={deleteProjectFileAction}>
                      <input type="hidden" name="id" value={file.id} />
                      <button className="small danger" type="submit">
                        删除
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {project.files.length === 0 && <div className="empty">暂无文件。</div>}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
