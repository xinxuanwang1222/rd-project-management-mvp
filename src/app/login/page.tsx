import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loginAction } from "@/server/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (user && !user.mustChangePassword) redirect("/");
  if (user?.mustChangePassword) redirect("/change-password");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>登录系统</h1>
        <p className="subtle">使用管理员分配的账号进入研发项目管理系统。</p>
        {params.error === "invalid" && <div className="error">账号、密码错误，或账号已停用。</div>}
        <form className="stack" action={loginAction}>
          <div className="field">
            <label htmlFor="username">账号</label>
            <input id="username" name="username" required autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button type="submit">登录</button>
        </form>
        <p className="subtle">演示账号：owner / Owner123!，admin / Admin123!，lead / Lead123!，member / Member123!</p>
      </section>
    </main>
  );
}
