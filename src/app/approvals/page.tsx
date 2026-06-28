import Link from "next/link";
import { Badge, approvalTone } from "@/components/badge";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { approvalStatusLabels, approvalTypeLabels, formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { decideApprovalAction } from "@/server/approval-actions";

export default async function ApprovalsPage() {
  const user = await requireUser();
  if (!user.canApproveProjects && !user.canApproveTasks) {
    return (
      <AppShell user={user}>
        <div className="empty">你没有审批权限。</div>
      </AppShell>
    );
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      OR: [
        ...(user.canApproveProjects ? [{ type: "PROJECT_INITIATION" as const }] : []),
        ...(user.canApproveTasks ? [{ type: "TASK_COMPLETION" as const }] : [])
      ]
    },
    include: { project: true, task: true, submittedBy: true, approver: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });

  return (
    <AppShell user={user}>
      <div className="header-row">
        <div>
          <h1>审批中心</h1>
          <p className="subtle">集中处理项目立项和任务完成审批。</p>
        </div>
        <Link className="button secondary" href="/">
          返回项目
        </Link>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>对象</th>
                <th>提交人</th>
                <th>状态</th>
                <th>提交时间</th>
                <th>说明/意见</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approvalTypeLabels[approval.type]}</td>
                  <td>
                    {approval.project ? (
                      <Link href={`/projects/${approval.project.id}`}>
                        <strong>{approval.project.name}</strong>
                      </Link>
                    ) : (
                      "-"
                    )}
                    {approval.task && <div className="subtle">任务：{approval.task.title}</div>}
                  </td>
                  <td>{approval.submittedBy.displayName}</td>
                  <td>
                    <Badge tone={approvalTone(approval.status)}>{approvalStatusLabels[approval.status]}</Badge>
                  </td>
                  <td>{formatDateTime(approval.createdAt)}</td>
                  <td>
                    <div>{approval.requestNote || "-"}</div>
                    {approval.decisionNote && <div className="subtle">审批意见：{approval.decisionNote}</div>}
                  </td>
                  <td>
                    {approval.status === "PENDING" ? (
                      <form className="stack" action={decideApprovalAction}>
                        <input type="hidden" name="id" value={approval.id} />
                        <input name="decisionNote" placeholder="审批意见" />
                        <div className="inline-actions">
                          <button className="small" name="decision" value="APPROVED" type="submit">
                            通过
                          </button>
                          <button className="small danger" name="decision" value="REJECTED" type="submit">
                            拒绝
                          </button>
                        </div>
                      </form>
                    ) : (
                      <span className="subtle">
                        {approval.approver?.displayName || "-"} · {formatDateTime(approval.decidedAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {approvals.length === 0 && <div className="empty">暂无审批记录。</div>}
        </div>
      </section>
    </AppShell>
  );
}
