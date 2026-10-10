import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MIN_SKILL_COUNT = 3;

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill statistics — NextAdventureAI" },
      {
        name: "description",
        content:
          "See which skills your active job postings ask for most, so you know what to learn and highlight next.",
      },
      { property: "og:title", content: "Skill statistics — NextAdventureAI" },
      {
        property: "og:description",
        content: "How often each skill appears across the jobs you're actively considering.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SkillStats,
});

function SkillStats() {
  const { user, loading } = useAuth();

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
          Sign in to see your skill statistics.
          <div className="mt-4">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const active = (jobs.data ?? []).filter((job) => job.is_active);

  const counts = new Map<string, { label: string; count: number }>();
  for (const job of active) {
    const seen = new Set<string>();
    for (const raw of job.skills ?? []) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }

  const ranked = [...counts.values()]
    .filter((skill) => skill.count >= MIN_SKILL_COUNT)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const hidden = [...counts.values()].filter((skill) => skill.count < MIN_SKILL_COUNT).length;
  const max = ranked[0]?.count ?? 1;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Skill statistics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Based on {active.length} active {active.length === 1 ? "job" : "jobs"}. Switch a job to
        inactive on the{" "}
        <Link to="/jobs" className="text-primary hover:underline">
          jobs page
        </Link>{" "}
        to leave it out.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Active jobs</p>
          <p className="font-display text-3xl font-semibold">{active.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Distinct skills</p>
          <p className="font-display text-3xl font-semibold">{ranked.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Most requested</p>
          <p className="font-display text-2xl font-semibold">{ranked[0]?.label ?? "—"}</p>
        </div>
      </div>

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-semibold">Skills across your active jobs</h2>
        {ranked.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No skills yet — save and process a job posting to start building statistics.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {ranked.map((skill) => (
              <li key={skill.label} className="flex items-center gap-4">
                <span className="w-44 shrink-0 truncate text-sm">{skill.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(skill.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm text-muted-foreground">
                  {skill.count} of {active.length} (
                  {Math.round((skill.count / Math.max(active.length, 1)) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
