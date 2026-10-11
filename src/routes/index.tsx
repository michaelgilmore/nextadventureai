import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Compass, ExternalLink, Sparkles } from "lucide-react";

import { AppShell, ScoreDial } from "@/components/AppShell";
import { FlaggedOnlyToggle, JobFlagButton } from "@/components/JobFlag";
import { JobSortSelect, sortJobs, type JobSort } from "@/components/JobSort";
import { JobStatusSelect } from "@/components/JobStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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


function Home() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const process = useServerFn(processJobLink);

  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [needsText, setNeedsText] = useState(false);
  const [sort, setSort] = useState<JobSort>("score");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

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
  const sortedJobs = sortJobs(
    (jobs.data ?? []).filter((job) => !flaggedOnly || job.is_flagged),
    sort,
  );

  const [similar, setSimilar] = useState<
    { title: string | null; company: string | null; created_at: string } | null
  >(null);
  const [blocked, setBlocked] = useState<{ name: string; description: string } | null>(null);

  const addJob = useMutation({
    mutationFn: (confirmSimilar: boolean = false) =>
      process({ data: { url, pastedText: pastedText || undefined, confirmSimilar } }),
    onSuccess: (result) => {
      if (result.status === "blocked_company") {
        setBlocked(result.company);
        return;
      }
      if (result.status === "similar") {
        setSimilar(result.existing);
        return;
      }
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
        result.scored && result.job.match_score !== null
          ? `Job saved. Match score: ${result.job.match_score}/100.`
          : "Job saved. Add a resume to get a match score.",
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
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/40"
        />
        <div className="relative flex flex-col items-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Compass className="size-7" />
          </span>
          <h1 className="text-gradient mt-8 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            NextAdventureAI
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Don't just find a job; search for an adventure.
          </p>
          <Button asChild size="lg" className="mt-10 px-10 text-base">
            <Link to="/auth">
              Let's Go!
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <section className="panel p-6">
        <h1 className="text-2xl font-semibold">Add a job posting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the job description — duplicates are caught automatically.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="pasted-job">Job description</Label>
          <Textarea
            id="pasted-job"
            rows={10}
            placeholder="Copy the full job description and paste it here."
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
          />
          {needsText && (
            <p className="text-sm text-amber-400">
              That link couldn't be read automatically — paste the description above.
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="job-link">Job link (optional)</Label>
          <Input
            id="job-link"
            placeholder="https://www.linkedin.com/jobs/view/4012345678/"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>

        <Button
          className="mt-4 sm:w-48"
          disabled={addJob.isPending || (pastedText.trim().length < 200 && !url.trim())}
          onClick={() => addJob.mutate(false)}
        >
          <Sparkles className="size-4" />
          {addJob.isPending ? "Processing…" : "Process job"}
        </Button>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Your pipeline</h2>
        <div className="flex items-center gap-4">
          <JobSortSelect value={sort} onChange={setSort} />
          <FlaggedOnlyToggle flaggedOnly={flaggedOnly} onChange={setFlaggedOnly} />
          <span className="text-sm text-muted-foreground">{jobs.data?.length ?? 0} saved</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {jobs.data?.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Nothing saved yet. Process your first job link above.
          </div>
        )}

        {sortedJobs.map((job) => (
          <div key={job.id} className="panel flex items-center gap-5 p-5">
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
                {(job.skills ?? []).slice(0, 4).map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
              <JobStatusSelect jobId={job.id} value={job.status} invalidateKeys={[["jobs"]]} />
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
      <AlertDialog open={Boolean(similar)} onOpenChange={(o) => !o && setSimilar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This job may already be saved</AlertDialogTitle>
            <AlertDialogDescription>
              You already have "{similar?.title}" at {similar?.company}
              {similar?.created_at
                ? `, added on ${new Date(similar.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}`
                : ""}
              . Do you want to add this job anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Don't add</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSimilar(null);
                addJob.mutate(true);
              }}
            >
              Add anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(blocked)} onOpenChange={(o) => !o && setBlocked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job not added — {blocked?.name} is rated 0</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {blocked?.description || "You marked this company as one not to consider."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlocked(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
