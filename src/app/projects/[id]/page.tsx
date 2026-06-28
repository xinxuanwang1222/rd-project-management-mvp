import Link from "next/link";
import { Badge, approvalTone } from "@/components/badge";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import {
  approvalStatusLabels,
  approvalTypeLabels,
  fileTypeLabels,
  formatDate,
  formatDateTime,
  noteTypeLabels,
  projectApprovalLabels,
  projectStatusLabels,
  taskApprovalLabels,
  taskStatusLabels
} from "@/lib/labels";
import { canManageFile, canManageProject, canViewProject, canWriteProjectNote } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { decideApprovalAction } from "@/server/approval-actions";
import {
  addProjectNoteAction,
  deleteProjectFileAction,
  deleteProjectNoteAction,
  resubmitProjectAction,
  uploadProjectFileAction
} from "@/server/project-actions";
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
        files: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
        tasks: { include: { assignee: true, createdBy: true }, orderBy: { updatedAt: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
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
  const canNote = canWriteProjectNote(user, { ownerId: project.ownerId, assigneeIds });
  const pendingProjectApproval = project.approvals.find(
    (approval) => approval.type === "PROJECT_INITIATION" && approval.status === "PENDING"
  );

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>{project.name}</h1>
          <p className="subtle">
            {project.clientName || "未填写客户"} · {project.productName || "未填写产品"} · 最近更新{" "}
            {formatDateTime(project.updatedAt)}
          </p>
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

      <div className="split">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>项目概览</h2>
              <div className="inline-actions">
                <Badge>{projectStatusLabels[project.status]}</Badge>
                <Badge tone={approvalTone(project.approvalStatus)}>{projectApprovalLabels[project.approvalStatus]}</Badge>
              </div>
            </div>
            <div className="panel-body">
              <div className="meta">
                <div>
                  <span>负责人</span>
                  {project.owner.displayName}
                </div>
                <div>
                  <span>创建人</span>
                  {project.createdBy.displayName}
                </div>
                <div>
                  <span>开始时间</span>
                  {formatDate(project.startDate)}
                </div>
                <div>
                  <span>创建时间</span>
                  {formatDateTime(project.createdAt)}
                </div>
              </div>
              <p>{project.note || "暂无项目备注。"}</p>
              {project.approvalStatus === "REJECTED" && canEditProject && (
                <form className="stack" action={resubmitProjectAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <div className="field">
                    <label>重新提交说明</label>
                    <textarea name="requestNote" placeholder="说明本次修改了什么" />
                  </div>
                  <button type="submit">重新提交立项</button>
                </form>
              )}
              {pendingProjectApproval && user.canApproveProjects && (
                <form className="stack" action={decideApprovalAction}>
                  <input type="hidden" name="id" value={pendingProjectApproval.id} />
                  <div className="field">
                    <label>立项审批意见</label>
                    <textarea name="decisionNote" />
                  </div>
                  <div className="inline-actions">
                    <button name="decision" value="APPROVED" type="submit">
                      通过立项
                    </button>
                    <button className="danger" name="decision" value="REJECTED" type="submit">
                      拒绝
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>项目文件</h2>
              <span className="subtle">{project.files.length} 个文件</span>
            </div>
            <div className="panel-body stack">
              {canFiles && (
                <form className="form-grid" action={uploadProjectFileAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="field">
                    <label>选择文件</label>
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
                  <div className="field">
                    <label>显示名称</label>
                    <input name="fileName" placeholder="默认使用上传文件名" />
                  </div>
                  <div className="field">
                    <label>备注</label>
                    <input name="note" />
                  </div>
                  <button className="span-2" type="submit">
                    上传文件
                  </button>
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>文件名</th>
                      <th>类型</th>
                      <th>上传人</th>
                      <th>上传时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.files.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <strong>{file.fileName}</strong>
                          <div className="subtle">{file.note || file.originalName}</div>
                        </td>
                        <td>{fileTypeLabels[file.fileType]}</td>
                        <td>{file.uploadedBy.displayName}</td>
                        <td>{formatDateTime(file.createdAt)}</td>
                        <td>
                          <div className="inline-actions">
                            <Link className="button small secondary" href={`/files/${file.id}/download`}>
                              下载
                            </Link>
                            {canFiles && (
                              <form action={deleteProjectFileAction}>
                                <input type="hidden" name="id" value={file.id} />
                                <button className="small danger" type="submit">
                                  删除
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {project.files.length === 0 && <div className="empty">暂无文件。</div>}
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>任务</h2>
              <span className="subtle">{project.tasks.length} 个任务</span>
            </div>
            <div className="panel-body stack">
              {canEditProject && (
                <form className="stack" action={createTaskAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="field">
                    <label>任务标题</label>
                    <input name="title" required />
                  </div>
                  <div className="form-grid">
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
                  </div>
                  <div className="field">
                    <label>备注</label>
                    <input name="note" />
                  </div>
                  <input type="hidden" name="status" value="TODO" />
                  <button type="submit">创建任务</button>
                </form>
              )}

              {project.tasks.map((task) => {
                const canEditTask = canEditProject || task.assigneeId === user.id;
                return (
                  <div className="panel" key={task.id}>
                    <div className="panel-body stack">
                      <div>
                        <strong>{task.title}</strong>
                        <div className="inline-actions" style={{ marginTop: 8 }}>
                          <Badge>{taskStatusLabels[task.status]}</Badge>
                          <Badge tone={approvalTone(task.approvalStatus === "NONE" ? "APPROVED" : task.approvalStatus)}>
                            {taskApprovalLabels[task.approvalStatus]}
                          </Badge>
                        </div>
                      </div>
                      <div className="meta">
                        <div>
                          <span>负责人</span>
                          {task.assignee.displayName}
                        </div>
                        <div>
                          <span>截止日期</span>
                          {formatDate(task.dueDate)}
                        </div>
                      </div>
                      <p className="subtle">{task.note || "暂无任务备注。"}</p>
                      {canEditTask && (
                        <form className="stack" action={updateTaskAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="title" value={task.title} />
                          <input type="hidden" name="assigneeId" value={task.assigneeId} />
                          <input type="hidden" name="dueDate" value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""} />
                          <input type="hidden" name="note" value={task.note ?? ""} />
                          <div className="field">
                            <label>更新状态</label>
                            <select name="status" defaultValue={task.status}>
                              {Object.entries(taskStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>完成审批说明</label>
                            <input name="requestNote" placeholder="仅提交已完成时使用" />
                          </div>
                          <button type="submit">保存任务状态</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
              {project.tasks.length === 0 && <div className="empty">暂无任务。</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>进度记录</h2>
            </div>
            <div className="panel-body stack">
              {canNote && (
                <form className="stack" action={addProjectNoteAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="field">
                    <label>类型</label>
                    <select name="type">
                      {Object.entries(noteTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>内容</label>
                    <textarea name="content" required />
                  </div>
                  <button type="submit">添加记录</button>
                </form>
              )}
              {project.notes.map((note) => (
                <div className="panel" key={note.id}>
                  <div className="panel-body">
                    <div className="inline-actions">
                      <Badge>{noteTypeLabels[note.type]}</Badge>
                      <span className="subtle">
                        {note.author.displayName} · {formatDateTime(note.createdAt)}
                      </span>
                      {note.authorId === user.id && (
                        <form action={deleteProjectNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <button className="small danger" type="submit">
                            删除
                          </button>
                        </form>
                      )}
                    </div>
                    <p>{note.content}</p>
                  </div>
                </div>
              ))}
              {project.notes.length === 0 && <div className="empty">暂无进度记录。</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>审批历史</h2>
            </div>
            <div className="panel-body stack">
              {project.approvals.map((approval) => (
                <div className="panel" key={approval.id}>
                  <div className="panel-body">
                    <div className="inline-actions">
                      <Badge>{approvalTypeLabels[approval.type]}</Badge>
                      <Badge tone={approvalTone(approval.status)}>{approvalStatusLabels[approval.status]}</Badge>
                    </div>
                    <p className="subtle">
                      提交：{approval.submittedBy.displayName} · {formatDateTime(approval.createdAt)}
                    </p>
                    {approval.requestNote && <p>{approval.requestNote}</p>}
                    {approval.decisionNote && (
                      <p className="subtle">
                        审批：{approval.approver?.displayName || "-"} · {approval.decisionNote}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {project.approvals.length === 0 && <div className="empty">暂无审批记录。</div>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
