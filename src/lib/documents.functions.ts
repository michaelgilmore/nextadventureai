import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiText } from "./ai-text.server";

type Input = { jobId: string; kind: "resume" | "cover_letter"; useSeed: boolean; extraInfo?: string };

export const generateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({
    jobId: String(input.jobId),
    kind: input.kind === "cover_letter" ? ("cover_letter" as const) : ("resume" as const),
    useSeed: Boolean(input.useSeed),
    extraInfo: typeof input.extraInfo === "string" ? input.extraInfo.slice(0, 4000) : "",
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
    if (data.kind === "cover_letter" && data.extraInfo.trim())
      input += `\n\nADDITIONAL INFORMATION FOR THIS COVER LETTER (include where relevant; treat as true facts about the candidate or their interest in this role)\n${data.extraInfo.trim()}`;

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
        ? "Rewrite the candidate's resume tailored to this job. Start with the candidate's name and complete contact information header copied verbatim from the CANDIDATE RESUME, preserving its line breaks and order. Never omit or invent contact information. Use only facts from the resume — never invent employers, dates, degrees or metrics. Reorder and rephrase to emphasize relevant experience and job keywords. Output clean plain text with clear section headings, no markdown symbols, no commentary."
        : "Write a concise, warm, specific cover letter (250-400 words in the letter body) for this job using only facts from the resume and seed information. Start with the candidate's name and complete contact information header copied verbatim from the CANDIDATE RESUME, preserving its line breaks and order, exactly as in a generated resume. Never omit or invent contact information and do not use contact details from previous examples. Follow the header with a blank line, then the greeting and letter body. Never invent experience. Output plain text only, no commentary.";

    const layoutInstructions = data.kind === "resume"
      ? " Format for a professional resume of no more than two US Letter pages: aim for 650-850 words total, maximum 900 including the contact header. Follow the contact header with a blank line. Use short uppercase section headings on their own lines, compact job/employer/date lines, and concise achievement bullets beginning with '- '. Prioritize relevant achievements, compress older roles, and avoid repetitive summaries and excessive sections. Do not use tables, columns, tab spacing, markdown emphasis, or page-break markers. Do not invent facts or discard essential employment dates and qualifications to fill a word quota."
      : " Format for a professional one-page US Letter cover letter: keep the letter body to 250-320 words and the entire document under 400 words including the header. Separate the greeting, each of 3-4 compact body paragraphs, the closing, and the signature with blank lines. Use no subject heading, bullet lists, markdown, or extra blank lines. Keep the contact header identical to the primary resume; never fabricate dates or recipient addresses.";
    const { prepareApplicationDocument } = await import("./document-preparation.server");
    return prepareApplicationDocument({
      kind: data.kind,
      instructions: instructions + layoutInstructions,
      input,
      generateText: aiText,
    });
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
