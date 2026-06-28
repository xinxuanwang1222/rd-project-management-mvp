import { Badge } from "@/components/badge";
import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { createUserAction, resetPasswordAction, toggleUserAction, updateUserAction } from "@/server/user-actions";

const permissionLabels = [
  ["canApproveProjects", "项目审批"],
  ["canApproveTasks", "任务审批"],
  ["canManageUsers", "账号管理"],
  ["canManageAllProjects", "管理全部项目"],
  ["canManageFiles", "文件管理"]
] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission((item) => item.canManageUsers);
  const params = await searchParams;
  const users = await prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>用户管理</h1>
          <p className="subtle">系统管理员维护账号；业务审批权限和账号管理权限独立配置。</p>
        </div>
      </div>
      {params.error === "self-admin" && <div className="error">不能移除自己的账号管理权限。</div>}
      {params.error === "self-disable" && <div className="error">不能停用自己的账号。</div>}

      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <h2>创建账号</h2>
          </div>
          <form className="panel-body stack" action={createUserAction}>
            <div className="form-grid">
              <div className="field">
                <label>账号</label>
                <input name="username" required />
              </div>
              <div className="field">
                <label>姓名</label>
                <input name="displayName" required />
              </div>
              <div className="field">
                <label>基础角色</label>
                <select name="role" defaultValue="RD_MEMBER">
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>临时密码</label>
                <input name="tempPassword" defaultValue="Temp12345!" />
              </div>
            </div>
            <div className="check-grid">
              {permissionLabels.map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input name={key} type="checkbox" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <button type="submit">创建并要求改密</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>账号列表</h2>
          </div>
          <div className="panel-body stack">
            {users.map((item) => (
              <div className="panel" key={item.id}>
                <div className="panel-body stack">
                  <div className="inline-actions">
                    <strong>{item.displayName}</strong>
                    <span className="subtle">@{item.username}</span>
                    <Badge tone={item.isActive ? "ok" : "danger"}>{item.isActive ? "启用" : "停用"}</Badge>
                    {item.mustChangePassword && <Badge tone="warn">需改密</Badge>}
                  </div>
                  <form className="stack" action={updateUserAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <div className="form-grid">
                      <div className="field">
                        <label>姓名</label>
                        <input name="displayName" defaultValue={item.displayName} required />
                      </div>
                      <div className="field">
                        <label>基础角色</label>
                        <select name="role" defaultValue={item.role}>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="check-grid">
                      {permissionLabels.map(([key, label]) => (
                        <label className="check-row" key={key}>
                          <input name={key} type="checkbox" defaultChecked={Boolean(item[key])} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <button className="small" type="submit">
                      保存权限
                    </button>
                  </form>
                  <div className="inline-actions">
                    <form className="inline-actions" action={resetPasswordAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input name="tempPassword" defaultValue="Temp12345!" aria-label="临时密码" />
                      <button className="small secondary" type="submit">
                        重置密码
                      </button>
                    </form>
                    <form action={toggleUserAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="isActive" value={item.isActive ? "false" : "true"} />
                      <button className={`small ${item.isActive ? "danger" : "secondary"}`} type="submit">
                        {item.isActive ? "停用" : "启用"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
