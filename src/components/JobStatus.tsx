import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const JOB_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "not a fit",
] as const;

export function statusLabel(status: string) {
  return status === "not a fit" ? "Not a fit" : status.charAt(0).toUpperCase() + status.slice(1);
}

export function JobStatusSelect({
  jobId,
  value,
  invalidateKeys,
}: {
  jobId: string;
  value: string;
  /** Query keys to invalidate after the update, e.g. [["jobs"]] or [["job", id], ["jobs"]]. */
  invalidateKeys: string[][];
}) {
  const queryClient = useQueryClient();

  return (
    <select
      className="rounded-md border border-input bg-secondary px-2 py-1 text-sm"
      value={value}
      onChange={async (event) => {
        await supabase.from("jobs").update({ status: event.target.value }).eq("id", jobId);
        for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      }}
    >
      {JOB_STATUSES.map((status) => (
        <option key={status} value={status}>
          {statusLabel(status)}
        </option>
      ))}
    </select>
  );
}
