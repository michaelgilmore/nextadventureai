import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const LEVEL_LABELS = ["Not started", "Beginner", "Basic", "Working", "Strong", "Expert"];

export type UserSkill = Tables<"user_skills">;
export type SkillHistory = Tables<"skill_level_history">;

export function useUserSkills(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_skills", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [skills, history] = await Promise.all([
        supabase.from("user_skills").select("*").order("label"),
        supabase.from("skill_level_history").select("*").order("recorded_at"),
      ]);
      if (skills.error) throw skills.error;
      if (history.error) throw history.error;
      return { skills: skills.data, history: history.data };
    },
  });
}

export function LevelDots({ level, target }: { level: number; target: number }) {
  return (
    <span className="flex gap-1" aria-label={`Level ${level} of 5, target ${target}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-2.5 w-2.5 rounded-full ${
            n <= level ? "bg-primary" : n <= target ? "border border-primary" : "bg-secondary"
          }`}
        />
      ))}
    </span>
  );
}

export function SkillEditor({
  userId,
  skillKey,
  label,
  existing,
  history,
  onClose,
}: {
  userId: string;
  skillKey: string;
  label: string;
  existing: UserSkill | undefined;
  history: SkillHistory[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [level, setLevel] = useState(existing?.level ?? 0);
  const [target, setTarget] = useState(existing?.target_level ?? 3);
  const [plan, setPlan] = useState(existing?.improvement_plan ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_skills").upsert(
        {
          user_id: userId,
          skill_key: skillKey,
          label,
          level,
          target_level: target,
          improvement_plan: plan.trim().slice(0, 4000),
        },
        { onConflict: "user_id,skill_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Saved your level for ${label}.`);
      qc.invalidateQueries({ queryKey: ["user_skills"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      const { error } = await supabase.from("user_skills").delete().eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_skills"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const picker = (value: number, set: (n: number) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {LEVEL_LABELS.map((name, n) => (
        <button
          key={name}
          type="button"
          onClick={() => set(n)}
          className={`rounded-md border px-2.5 py-1 text-xs ${
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary"
          }`}
        >
          {n} · {name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border bg-background/40 p-4">
      <div>
        <p className="mb-1.5 text-sm font-medium">My current level</p>
        {picker(level, setLevel)}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Target level</p>
        {picker(target, setTarget)}
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">How I'll improve</p>
        <Textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="Courses, projects, practice, certifications…"
          rows={3}
        />
      </div>
      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium">Progress history</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.recorded_at).toLocaleDateString()} — level {h.level} (
                {LEVEL_LABELS[h.level]})
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Stop tracking
          </Button>
        )}
      </div>
    </div>
  );
}
