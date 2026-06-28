export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function approvalTone(status: string) {
  if (status === "APPROVED") return "ok" as const;
  if (status === "REJECTED") return "danger" as const;
  return "warn" as const;
}
