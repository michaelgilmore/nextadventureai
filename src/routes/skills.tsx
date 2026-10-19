import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { LEVEL_LABELS, LevelDots, SkillEditor, useUserSkills } from "@/components/SkillLevels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const mine = useUserSkills(user?.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [customLabel, setCustomLabel] = useState("");

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

  const mySkills = mine.data?.skills ?? [];
  const mineByKey = new Map(mySkills.map((s) => [s.skill_key, s]));
  const historyFor = (id: string | undefined) =>
    id ? (mine.data?.history ?? []).filter((h) => h.skill_id === id) : [];
  const atTarget = mySkills.filter((s) => s.level >= s.target_level).length;

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

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Active jobs</p>
          <p className="font-display text-3xl font-semibold">{active.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Skills shown</p>
          <p className="font-display text-3xl font-semibold">{ranked.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Most requested</p>
          <p className="font-display text-2xl font-semibold">{ranked[0]?.label ?? "—"}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Skills at target</p>
          <p className="font-display text-3xl font-semibold">
            {atTarget}/{mySkills.length}
          </p>
        </div>
      </div>

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-semibold">My skill levels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate yourself 0–5 on any skill below. Filled dots are your level, outlined dots show the
          gap to your target. Every change is recorded so you can see your progress.
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Track another skill, e.g. Kubernetes"
            className="max-w-xs"
          />
          <Button
            variant="secondary"
            disabled={!newSkill.trim()}
            onClick={() => {
              setEditing(newSkill.trim().toLowerCase());
              setCustomLabel(newSkill.trim());
              setNewSkill("");
            }}
          >
            Add
          </Button>
        </div>
        {customLabel && editing === customLabel.toLowerCase() && (
          <SkillEditor
            userId={user.id}
            skillKey={customLabel.toLowerCase()}
            label={customLabel}
            existing={mineByKey.get(customLabel.toLowerCase())}
            history={historyFor(mineByKey.get(customLabel.toLowerCase())?.id)}
            onClose={() => {
              setEditing(null);
              setCustomLabel("");
            }}
          />
        )}
        {mySkills.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {mySkills.map((s) => (
              <li key={s.id} className="py-3">
                <button
                  type="button"
                  onClick={() => {
                    setCustomLabel(s.label);
                    setEditing(editing === s.skill_key ? null : s.skill_key);
                  }}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <span className="w-44 shrink-0 truncate text-sm">{s.label}</span>
                  <LevelDots level={s.level} target={s.target_level} />
                  <span className="text-xs text-muted-foreground">
                    {LEVEL_LABELS[s.level]} → target {LEVEL_LABELS[s.target_level]}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {(counts.get(s.skill_key)?.count ?? 0)} active{" "}
                    {counts.get(s.skill_key)?.count === 1 ? "job" : "jobs"}
                  </span>
                </button>
                {s.improvement_plan && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.improvement_plan}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-semibold">Skills across your active jobs</h2>
        {ranked.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {hidden > 0
              ? `No skill has been asked for ${MIN_SKILL_COUNT} times yet — ${hidden} ${
                  hidden === 1 ? "skill is" : "skills are"
                } still waiting for more jobs to request them.`
              : "No skills yet — save and process a job posting to start building statistics."}
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {ranked.map((skill) => {
              const key = skill.label.toLowerCase();
              const mine = mineByKey.get(key);
              return (
                <li key={skill.label}>
                  <div className="flex items-center gap-4">
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
                    <button
                      type="button"
                      onClick={() => setEditing(editing === key ? null : key)}
                      className="flex w-32 shrink-0 items-center justify-end gap-2 text-xs text-muted-foreground hover:text-primary"
                    >
                      {mine ? (
                        <LevelDots level={mine.level} target={mine.target_level} />
                      ) : (
                        "Rate my level"
                      )}
                    </button>
                  </div>
                  {editing === key && (
                    <SkillEditor
                      userId={user.id}
                      skillKey={key}
                      label={skill.label}
                      existing={mine}
                      history={historyFor(mine?.id)}
                      onClose={() => setEditing(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hidden > 0 && ranked.length > 0 && (
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            {hidden} {hidden === 1 ? "skill that appears" : "skills that appear"} only once or
            twice {hidden === 1 ? "is" : "are"} hidden — {hidden === 1 ? "it" : "they"}{" "}
            {hidden === 1 ? "stays" : "stay"} saved and {hidden === 1 ? "appears" : "appear"} here
            once {MIN_SKILL_COUNT} jobs ask for {hidden === 1 ? "it" : "them"}.
          </p>
        )}
      </section>
    </AppShell>
  );
}
