import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { AppShell, ScoreDial } from "@/components/AppShell";
import { FlaggedOnlyToggle, JobFlagButton } from "@/components/JobFlag";
import { JobSortSelect, sortJobs, type JobSort } from "@/components/JobSort";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs you're considering — NextAdventureAI" },
      {
        name: "description",
        content:
          "Browse every job you've saved, mark roles active or inactive and jump into match score details.",
      },
      { property: "og:title", content: "Jobs you're considering — NextAdventureAI" },
      {
        property: "og:description",
        content: "Every saved role in one list, with match scores and an active/inactive switch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsList,
});

const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;
const FILTERS = ["all", "active", "inactive"] as const;

function JobsList() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState<JobSort>("score");

  const jobs = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <AppShell>Loading…</AppShell>;

  if (!user) {
    return (
      <AppShell>
        <div className="panel p-8 text-center text-muted-foreground">
          Sign in to see the jobs you're considering.
          <div className="mt-4">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const all = jobs.data ?? [];
  const visible = sortJobs(
    all.filter(
      (job) =>
        (filter === "all" ? true : filter === "active" ? job.is_active : !job.is_active) &&
        (!flaggedOnly || job.is_flagged),
    ),
    sort,
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Jobs you're considering</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {all.filter((job) => job.is_active).length} active of {all.length} saved. Only active
            roles count towards your skill statistics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <JobSortSelect value={sort} onChange={setSort} />
          <FlaggedOnlyToggle flaggedOnly={flaggedOnly} onChange={setFlaggedOnly} />
          <div className="flex gap-1 rounded-lg border border-border/70 p-1">
            {FILTERS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? "secondary" : "ghost"}
                className="capitalize"
                onClick={() => setFilter(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {visible.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            {all.length === 0
              ? "No jobs here yet. Process a job link on the home page."
              : "No jobs match these filters."}
          </div>
        )}

        {visible.map((job) => (
          <div
            key={job.id}
            className={`panel flex items-center gap-5 p-5 ${job.is_active ? "" : "opacity-60"}`}
          >
            <ScoreDial score={job.match_score} />
            <JobFlagButton jobId={job.id} flagged={job.is_flagged} />
            <div className="min-w-0 flex-1">
              <Link
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="font-display text-lg font-semibold hover:text-primary"
              >
                {job.title ?? "Untitled role"}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {[job.company, job.location, job.workplace_type].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(job.skills ?? []).slice(0, 6).map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {job.is_active ? "Active" : "Inactive"}
                <Switch
                  checked={job.is_active}
                  onCheckedChange={async (checked) => {
                    await supabase.from("jobs").update({ is_active: checked }).eq("id", job.id);
                    queryClient.invalidateQueries({ queryKey: ["jobs"] });
                  }}
                />
              </label>
              <select
                className="rounded-md border border-input bg-secondary px-2 py-1 text-sm capitalize"
                value={job.status}
                onChange={async (event) => {
                  await supabase
                    .from("jobs")
                    .update({ status: event.target.value })
                    .eq("id", job.id);
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                }}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open posting <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
