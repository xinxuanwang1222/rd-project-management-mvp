import { requireUserAllowingPasswordChange } from "@/lib/auth";
import { changePasswordAction } from "@/server/auth-actions";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUserAllowingPasswordChange();
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>修改临时密码</h1>
        <p className="subtle">首次登录或管理员重置密码后，需要设置自己的新密码。</p>
        {params.error === "invalid" && <div className="error">新密码至少 8 位，且两次输入必须一致。</div>}
        {params.error === "current" && <div className="error">当前临时密码不正确。</div>}
        <form className="stack" action={changePasswordAction}>
          <div className="field">
            <label>当前密码</label>
            <input name="currentPassword" type="password" required />
          </div>
          <div className="field">
            <label>新密码</label>
            <input name="newPassword" type="password" required minLength={8} />
          </div>
          <div className="field">
            <label>确认新密码</label>
            <input name="confirmPassword" type="password" required minLength={8} />
          </div>
          <button type="submit">保存新密码</button>
        </form>
      </section>
    </main>
  );
}
