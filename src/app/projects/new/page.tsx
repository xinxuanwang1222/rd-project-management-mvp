import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { projectStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { createProjectAction } from "@/server/project-actions";

export default async function NewProjectPage() {
  const user = await requireUser();
  if (user.role !== "RD_LEAD") redirect("/");
  const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } });

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>新建项目</h1>
          <p className="subtle">保存后会自动生成一条项目立项审批申请。</p>
        </div>
        <Link className="button secondary" href="/">
          返回列表
        </Link>
      </div>
      <section className="panel">
        <form className="panel-body form-grid" action={createProjectAction}>
          <div className="field">
            <label>项目名称</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>负责人</label>
            <select name="ownerId" defaultValue={user.id} required>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>客户名称</label>
            <input name="clientName" />
          </div>
          <div className="field">
            <label>产品名称</label>
            <input name="productName" />
          </div>
          <div className="field">
            <label>项目状态</label>
            <select name="status" defaultValue="NOT_STARTED">
              {Object.entries(projectStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>开始时间</label>
            <input name="startDate" type="date" />
          </div>
          <div className="field span-2">
            <label>项目备注</label>
            <textarea name="note" />
          </div>
          <div className="inline-actions span-2">
            <button type="submit">保存并提交立项</button>
            <Link className="button secondary" href="/">
              取消
            </Link>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
