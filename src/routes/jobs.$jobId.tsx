import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, RefreshCw, Trash2 } from "lucide-react";

import { AppShell, ScoreDial } from "@/components/AppShell";
import { GenerateDocButtons } from "@/components/GenerateDocButtons";
import { SentDocUploads } from "@/components/SentDocUploads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { rescoreJob } from "@/lib/jobs.functions";

export const Route = createFileRoute("/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job details — NextAdventureAI" },
      {
        name: "description",
        content:
          "See the parsed details of a saved job posting plus its AI match score, strengths and gaps versus your resume.",
      },
      { property: "og:title", content: "Job details — NextAdventureAI" },
      {
        property: "og:description",
        content: "Parsed job details with an AI match score against your resume.",
      },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rescore = useServerFn(rescoreJob);

  const job = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: () => rescore({ data: { jobId } }),
    onSuccess: () => {
      toast.success("Match score refreshed.");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || job.isLoading) return <AppShell>Loading…</AppShell>;

  if (!user || !job.data) {
    return (
      <AppShell>
        <div className="panel p-8 text-center text-muted-foreground">
          This job isn't available.
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link to="/">Back to pipeline</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const data = job.data;

  return (
    <AppShell>
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      <section className="panel mt-4 flex flex-wrap items-start gap-6 p-6">
        <ScoreDial score={data.match_score} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold">{data.title ?? "Untitled role"}</h1>
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap gap-2">
                <GenerateDocButtons
                  jobId={data.id}
                  fileBase={(data.company ?? "job").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}
                />
              </div>
              <SentDocUploads jobId={data.id} />
            </div>
          </div>
          <p className="mt-1 text-muted-foreground">
            {[data.company, data.location, data.workplace_type, data.employment_type]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {data.salary && <p className="mt-1 text-sm text-primary">{data.salary}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" asChild>
              <a href={data.url} target="_blank" rel="noreferrer">
                Open posting <ExternalLink className="size-3" />
              </a>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={rescoreMutation.isPending}
              onClick={() => rescoreMutation.mutate()}
            >
              <RefreshCw className="size-3" />
              {rescoreMutation.isPending ? "Scoring…" : "Rescore"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await supabase.from("jobs").delete().eq("id", data.id);
                queryClient.invalidateQueries({ queryKey: ["jobs"] });
                navigate({ to: "/" });
              }}
            >
              <Trash2 className="size-3" /> Delete
            </Button>
          </div>
        </div>
      </section>

      {data.match_summary && (
        <section className="panel mt-6 p-6">
          <h2 className="text-lg font-semibold">Why this score</h2>
          <p className="mt-2 text-muted-foreground">{data.match_summary}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-success">Strengths</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {(data.strengths ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-warning">Gaps</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {(data.gaps ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-semibold">Role details</h2>
        {data.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {data.description}
          </p>
        )}
        {(data.requirements ?? []).length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold">Requirements</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {(data.requirements ?? []).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </>
        )}
        {(data.skills ?? []).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {(data.skills ?? []).map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
