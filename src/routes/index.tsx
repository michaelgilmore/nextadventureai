import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Sparkles } from "lucide-react";

import { AppShell, ScoreDial } from "@/components/AppShell";
import { JobSortSelect, sortJobs, type JobSort } from "@/components/JobSort";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { processJobLink } from "@/lib/jobs.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NextAdventureAI — Organize your job search with AI match scores" },
      {
        name: "description",
        content:
          "Paste a LinkedIn job link and NextAdventureAI checks for duplicates, saves the details and scores the role out of 100 against your resume.",
      },
      { property: "og:title", content: "NextAdventureAI — Organize your job search" },
      {
        property: "og:description",
        content:
          "Save LinkedIn job posts once, keep every detail in one place and see an AI match score against your resume.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;

function Home() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const process = useServerFn(processJobLink);

  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [needsText, setNeedsText] = useState(false);

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

  const addJob = useMutation({
    mutationFn: () => process({ data: { url, pastedText: pastedText || undefined } }),
    onSuccess: (result) => {
      if (result.status === "duplicate") {
        toast.info("You've already saved this job.");
        setUrl("");
        setPastedText("");
        setNeedsText(false);
        return;
      }
      if (result.status === "needs_text") {
        setNeedsText(true);
        toast.warning("LinkedIn blocked the page. Paste the job description below and try again.");
        return;
      }
      toast.success(
        result.scored ? "Job saved and scored." : "Job saved. Add a resume to get a match score.",
      );
      setUrl("");
      setPastedText("");
      setNeedsText(false);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) return <AppShell>Loading…</AppShell>;

  if (!user) {
    return (
      <AppShell>
        <section className="panel p-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Job search, organized</p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold sm:text-5xl">
            Paste a job link. Get a <span className="text-gradient">match score</span> out of 100.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            NextAdventureAI checks whether you've already seen the role, pulls out the details worth
            remembering, and compares it to your resume.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth">Get started free</Link>
          </Button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="panel p-6">
        <h1 className="text-2xl font-semibold">Add a job posting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a LinkedIn job link — duplicates are caught automatically.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="https://www.linkedin.com/jobs/view/4012345678/"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            className="sm:w-40"
            disabled={addJob.isPending || !url.trim()}
            onClick={() => addJob.mutate()}
          >
            <Sparkles className="size-4" />
            {addJob.isPending ? "Processing…" : "Process link"}
          </Button>
        </div>

        {needsText && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="pasted-job">Job description</Label>
            <Textarea
              id="pasted-job"
              rows={7}
              placeholder="Copy the job description from LinkedIn and paste it here."
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
            />
          </div>
        )}
      </section>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Your pipeline</h2>
        <span className="text-sm text-muted-foreground">{jobs.data?.length ?? 0} saved</span>
      </div>

      <div className="mt-4 space-y-3">
        {jobs.data?.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Nothing saved yet. Process your first job link above.
          </div>
        )}

        {jobs.data?.map((job) => (
          <div key={job.id} className="panel flex items-center gap-5 p-5">
            <ScoreDial score={job.match_score} />
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
                {(job.skills ?? []).slice(0, 4).map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
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
