import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, resumes, jobs, workExperience, skills, skillHistory] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("resumes").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("jobs").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("work_experience").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("user_skills").select("*").eq("user_id", userId).order("label"),
      supabase.from("skill_level_history").select("*").eq("user_id", userId).order("recorded_at"),
    ]);
    for (const r of [profile, resumes, jobs, workExperience, skills, skillHistory])
      if (r.error) throw new Error(r.error.message);
    return {
      exported_at: new Date().toISOString(),
      app: "NextAdventureAI",
      profile: profile.data,
      resumes: resumes.data ?? [],
      jobs: jobs.data ?? [],
      work_experience: workExperience.data ?? [],
      skills: skills.data ?? [],
      skill_level_history: skillHistory.data ?? [],
    };
  });
