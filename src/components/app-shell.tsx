import Link from "next/link";
import type { User } from "@prisma/client";
import { logoutAction } from "@/server/auth-actions";
import { roleLabels } from "@/lib/labels";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            研发项目管理
          </Link>
          <nav className="nav">
            <Link href="/">项目</Link>
            {(user.canApproveProjects || user.canApproveTasks) && <Link href="/approvals">审批中心</Link>}
            {user.canManageUsers && <Link href="/users">用户管理</Link>}
          </nav>
          <div className="user-chip">
            {user.displayName} · {roleLabels[user.role]}
          </div>
          <form action={logoutAction}>
            <button className="secondary small" type="submit">
              退出
            </button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
