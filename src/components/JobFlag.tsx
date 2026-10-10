import { useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function JobFlagButton({ jobId, flagged }: { jobId: string; flagged: boolean }) {
  const queryClient = useQueryClient();

  return (
    <button
      type="button"
      aria-label={flagged ? "Remove flag" : "Flag this job"}
      aria-pressed={flagged}
      title={flagged ? "Remove flag" : "Flag this job"}
      className={cn(
        "shrink-0 rounded-md p-1 transition-colors",
        flagged ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await supabase
          .from("jobs")
          .update({ is_flagged: !flagged })
          .eq("id", jobId);
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
      }}
    >
      <Flag className={cn("size-4", flagged && "fill-current")} />
    </button>
  );
}

export function FlaggedOnlyToggle({
  flaggedOnly,
  onChange,
}: {
  flaggedOnly: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={flaggedOnly}
      onClick={() => onChange(!flaggedOnly)}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        flaggedOnly
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border/70 text-muted-foreground hover:text-foreground",
      )}
    >
      <Flag className={cn("size-3.5", flaggedOnly && "fill-current text-primary")} />
      Flagged only
    </button>
  );
}
