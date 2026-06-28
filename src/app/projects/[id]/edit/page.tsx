import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { formatDate, projectStatusLabels } from "@/lib/labels";
import { canManageProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateProjectAction } from "@/server/project-actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [project, users] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } })
  ]);
  if (!project || !canManageProject(user, project.ownerId)) redirect("/");

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>编辑项目</h1>
          <p className="subtle">修改基础信息不会自动绕过已有审批状态。</p>
        </div>
        <Link className="button secondary" href={`/projects/${project.id}`}>
          返回详情
        </Link>
      </div>
      <section className="panel">
        <form className="panel-body form-grid" action={updateProjectAction}>
          <input type="hidden" name="id" value={project.id} />
          <div className="field">
            <label>项目名称</label>
            <input name="name" defaultValue={project.name} required />
          </div>
          <div className="field">
            <label>负责人</label>
            <select name="ownerId" defaultValue={project.ownerId} required>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>客户名称</label>
            <input name="clientName" defaultValue={project.clientName ?? ""} />
          </div>
          <div className="field">
            <label>产品名称</label>
            <input name="productName" defaultValue={project.productName ?? ""} />
          </div>
          <div className="field">
            <label>项目状态</label>
            <select name="status" defaultValue={project.status}>
              {Object.entries(projectStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>开始时间</label>
            <input name="startDate" type="date" defaultValue={project.startDate ? formatDate(project.startDate).replaceAll("/", "-") : ""} />
          </div>
          <div className="field span-2">
            <label>项目备注</label>
            <textarea name="note" defaultValue={project.note ?? ""} />
          </div>
          <div className="inline-actions span-2">
            <button type="submit">保存修改</button>
            <Link className="button secondary" href={`/projects/${project.id}`}>
              取消
            </Link>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
