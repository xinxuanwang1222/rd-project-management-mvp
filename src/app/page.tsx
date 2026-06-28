import Link from "next/link";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { Badge, approvalTone } from "@/components/badge";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, projectApprovalLabels, projectStatusLabels, taskStatusLabels } from "@/lib/labels";
import { canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string; ownerId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim();
  const status = params.status as ProjectStatus | undefined;
  const ownerId = params.ownerId;

  const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } });
  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { clientName: { contains: q } },
            { productName: { contains: q } },
            { owner: { displayName: { contains: q } } }
          ]
        }
      : {})
  };

  const [projects, pendingApprovals, fileCount, taskCount] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        owner: true,
        tasks: {
          include: {
            assignee: true,
            files: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } }
          },
          orderBy: { updatedAt: "desc" }
        },
        files: { include: { uploadedBy: true, task: true }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.projectFile.count(),
    prisma.task.count()
  ]);

  const visibleProjects = projects.filter((project) =>
    canViewProject(
      user,
      project.ownerId,
      project.tasks.map((task) => task.assigneeId)
    )
  );
  const isOwnerView = user.role === "OWNER";

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>项目列表</h1>
          <p className="subtle">集中查看研发项目、立项状态、下一步任务和资料归档情况。</p>
        </div>
        {user.role === "RD_LEAD" && (
          <Link className="button" href="/projects/new">
            新建项目
          </Link>
        )}
      </div>

      <section className="grid stats">
        <div className="stat">
          <span className="subtle">项目数量</span>
          <strong>{visibleProjects.length}</strong>
        </div>
        <div className="stat">
          <span className="subtle">待审批</span>
          <strong>{pendingApprovals}</strong>
        </div>
        <div className="stat">
          <span className="subtle">文件记录</span>
          <strong>{fileCount}</strong>
        </div>
        <div className="stat">
          <span className="subtle">任务数量</span>
          <strong>{taskCount}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-body">
          <form className="toolbar">
            <div className="field">
              <label>搜索</label>
              <input name="q" defaultValue={q} placeholder="项目名称、客户、产品、负责人" />
            </div>
            <div className="field">
              <label>项目状态</label>
              <select name="status" defaultValue={status ?? ""}>
                <option value="">全部状态</option>
                {Object.entries(projectStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>负责人</label>
              <select name="ownerId" defaultValue={ownerId ?? ""}>
                <option value="">全部负责人</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">筛选</button>
          </form>

          {isOwnerView ? (
            <div className="owner-project-list">
              {visibleProjects.map((project) => (
                <article className="owner-project-card" key={project.id}>
                  <div className="owner-project-head">
                    <div>
                      <div className="inline-actions">
                        <h2>{project.name}</h2>
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
                    </div>
                    <div className="owner-project-counts">
                      <Badge>{project.tasks.length} 个任务</Badge>
                      <Badge>{project.files.length} 个文件</Badge>
                    </div>
                  </div>

                  <div className="owner-project-grid">
                    <div className="owner-project-section">
                      <h3>任务信息</h3>
                      <div className="owner-task-list">
                        {project.tasks.map((task) => (
                          <div className="owner-task-row" key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              {task.note && <p>{task.note}</p>}
                            </div>
                            <div className="owner-task-meta">
                              <Badge>{taskStatusLabels[task.status]}</Badge>
                              <span>{task.assignee.displayName}</span>
                              <span>截止：{formatDate(task.dueDate)}</span>
                            </div>
                          </div>
                        ))}
                        {project.tasks.length === 0 && <div className="empty">暂无任务。</div>}
                      </div>
                    </div>

                    <div className="owner-project-section">
                      <h3>上传文件</h3>
                      <div className="owner-file-list">
                        {project.files.map((file) => (
                          <Link className="owner-file-row" href={`/files/${file.id}/download`} key={file.id}>
                            <strong>{file.fileName}</strong>
                            <span>
                              {file.uploadedBy.displayName} · {file.task ? file.task.title : "项目文件"}
                            </span>
                            <span>{formatDateTime(file.createdAt)}</span>
                          </Link>
                        ))}
                        {project.files.length === 0 && <div className="empty">暂无上传文件。</div>}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {visibleProjects.length === 0 && <div className="empty">没有匹配的项目。</div>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>客户/产品</th>
                    <th>负责人</th>
                    <th>状态</th>
                    <th>立项</th>
                    <th>下一步任务</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjects.map((project) => {
                    const nextTask = project.tasks.find((task) => task.status !== "COMPLETED");
                    return (
                      <tr key={project.id}>
                        <td>
                          <Link href={`/projects/${project.id}`}>
                            <strong>{project.name}</strong>
                          </Link>
                          <div className="subtle">开始：{formatDate(project.startDate)}</div>
                        </td>
                        <td>
                          {project.clientName || "-"}
                          <div className="subtle">{project.productName || "-"}</div>
                        </td>
                        <td>{project.owner.displayName}</td>
                        <td>
                          <Badge>{projectStatusLabels[project.status]}</Badge>
                        </td>
                        <td>
                          <Badge tone={approvalTone(project.approvalStatus)}>{projectApprovalLabels[project.approvalStatus]}</Badge>
                        </td>
                        <td>{nextTask ? nextTask.title : <span className="subtle">暂无待办</span>}</td>
                        <td>{formatDateTime(project.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleProjects.length === 0 && <div className="empty">没有匹配的项目。</div>}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
