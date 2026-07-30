type SupabaseLike = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
};


export function normalizeCronSecret(value: string | null | undefined): string {
  return (value || "")
    .replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, "")
    .trim();
}

export type CronLease = {
  jobKey: string;
  runId: string;
  allowed: boolean;
  reason?: string;
  forced: boolean;
};

function forceRequested(req: Request): boolean {
  const value = (req.headers.get("x-cron-force") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function beginCronRun(
  sb: SupabaseLike,
  req: Request,
  jobKey: string,
): Promise<CronLease> {
  const runId = crypto.randomUUID();
  const forced = forceRequested(req);
  const { data, error } = await sb.rpc("oga_cron_begin", {
    p_job_key: jobKey,
    p_run_id: runId,
    p_force: forced,
  });
  if (error) throw new Error(`CRON_BEGIN_FAILED:${error.message || error}`);
  return {
    jobKey,
    runId,
    allowed: Boolean(data?.allowed),
    reason: data?.reason ? String(data.reason) : undefined,
    forced,
  };
}

export async function finishCronRun(
  sb: SupabaseLike,
  lease: CronLease,
  success: boolean,
  result: Record<string, unknown> = {},
  errorMessage?: string,
): Promise<void> {
  if (!lease.allowed) return;
  const { error } = await sb.rpc("oga_cron_finish", {
    p_job_key: lease.jobKey,
    p_run_id: lease.runId,
    p_success: success,
    p_result: result,
    p_error: errorMessage || null,
  });
  if (error) {
    console.error("[cron-control] finish failed", lease.jobKey, lease.runId, error);
  }
}
