import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiText } from "./ai-text.server";

type Input = { jobId: string; kind: "resume" | "cover_letter"; useSeed: boolean };

export const generateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({
    jobId: String(input.jobId),
    kind: input.kind === "cover_letter" ? ("cover_letter" as const) : ("resume" as const),
    useSeed: Boolean(input.useSeed),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job, error } = await supabase.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (error || !job) throw new Error("Job not found.");
    const { data: resume } = await supabase
      .from("resumes")
      .select("content_text")
      .eq("is_primary", true)
      .maybeSingle();
    if (!resume?.content_text) throw new Error("Upload a primary resume first.");
    const { data: profile } = await supabase
      .from("profiles")
      .select("goals, cover_letter_seed")
      .maybeSingle();

    const jobBlock = [
      `Title: ${job.title ?? ""}`,
      `Company: ${job.company ?? ""}`,
      `Location: ${job.location ?? ""}`,
      `Description:\n${job.description ?? ""}`,
      `Requirements:\n${(job.requirements ?? []).join("\n")}`,
      `Skills: ${(job.skills ?? []).join(", ")}`,
    ].join("\n");

    let input = `JOB POSTING\n${jobBlock}\n\nCANDIDATE RESUME\n${resume.content_text.slice(0, 20000)}`;
    if (profile?.goals) input += `\n\nCANDIDATE GOALS\n${profile.goals}`;
    if (data.kind === "cover_letter" && data.useSeed && profile?.cover_letter_seed)
      input += `\n\nCOVER LETTER SEED INFORMATION (weave in where relevant)\n${profile.cover_letter_seed}`;

    const { data: examples } = await supabase
      .from("sent_documents")
      .select("content_text, job_id")
      .eq("kind", data.kind)
      .eq("include_in_future", true)
      .neq("job_id", data.jobId)
      .order("updated_at", { ascending: false })
      .limit(3);
    if (examples && examples.length > 0) {
      input += `\n\nPREVIOUSLY SENT ${data.kind === "resume" ? "RESUMES" : "COVER LETTERS"} (the candidate's own edited versions for other jobs — match their voice, style and preferred phrasing; facts here are true and may be used)\n`;
      input += examples.map((e, i) => `--- Example ${i + 1} ---\n${e.content_text.slice(0, 6000)}`).join("\n\n");
    }

    const instructions =
      data.kind === "resume"
        ? "Rewrite the candidate's resume tailored to this job. Use only facts from the resume — never invent employers, dates, degrees or metrics. Reorder and rephrase to emphasize relevant experience and job keywords. Output clean plain text with clear section headings, no markdown symbols, no commentary."
        : "Write a concise, warm, specific cover letter (250-400 words) for this job using only facts from the resume and seed information. Never invent experience. Output plain text only, starting with the greeting, no commentary.";

    const text = await aiText({ instructions, input });
    return { text };
  });

export const saveCoverLetterSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { seed: string }) => ({ seed: (input?.seed ?? "").slice(0, 8000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, cover_letter_seed: data.seed.trim() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
