import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseJobLink } from "@/lib/linkedin-url";

export type ParsedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  workplace_type: string | null;
  employment_type: string | null;
  seniority: string | null;
  salary: string | null;
  description: string | null;
  requirements: string[];
  skills: string[];
  posted_at: string | null;
};

export type MatchResult = {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
};

const PARSE_SYSTEM = `You extract structured data from a job posting.
Return ONLY JSON with these keys:
{"title":string|null,"company":string|null,"location":string|null,"workplace_type":"remote"|"hybrid"|"on-site"|null,"employment_type":string|null,"seniority":string|null,"salary":string|null,"description":string,"requirements":string[],"skills":string[],"posted_at":string|null}
"description" is a clean 2-4 paragraph summary of the role. Keep requirements short bullet phrases (max 12). Keep skills to concrete skills/tools (max 20). Use null when unknown. Never invent facts.`;

const SCORE_SYSTEM = `You are a careful technical recruiter. Compare a candidate resume to a job posting.
Return ONLY JSON: {"score":integer 0-100,"summary":string,"strengths":string[],"gaps":string[]}
score: 0-100 fit, weighing required skills, years of experience, domain, seniority and location/work model.
summary: 2-3 sentences addressed to the candidate. strengths: max 6 short phrases. gaps: max 6 short phrases naming what is missing or weak. Be honest and specific; do not inflate the score.`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok) return "";
    return stripHtml(await response.text());
  } catch (error) {
    console.error("Job page fetch failed", error);
    return "";
  }
}

async function fetchJobContent(canonicalUrl: string, jobId: string | null): Promise<string> {
  const candidates = jobId
    ? [
        `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
        `https://www.linkedin.com/jobs/view/${jobId}/`,
      ]
    : [canonicalUrl];

  for (const candidate of candidates) {
    const text = await fetchText(candidate);
    if (text.length > 600) return text.slice(0, 24000);
  }
  return "";
}

export const processJobLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; pastedText?: string }) => {
    if (!input?.url?.trim()) throw new Error("Please paste a job link.");
    return { url: input.url.trim(), pastedText: input.pastedText?.trim() ?? "" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parsed = parseJobLink(data.url);
    if (!parsed) throw new Error("That doesn't look like a valid job link.");

    // 1. Duplicate check — same link or same LinkedIn job already saved.
    const { data: existing } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .or(
        parsed.linkedinJobId
          ? `canonical_url.eq.${parsed.canonicalUrl},linkedin_job_id.eq.${parsed.linkedinJobId}`
          : `canonical_url.eq.${parsed.canonicalUrl}`,
      )
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { status: "duplicate" as const, job: existing };
    }

    // 2. Get the posting text.
    let sourceText = data.pastedText;
    if (!sourceText) {
      sourceText = await fetchJobContent(parsed.canonicalUrl, parsed.linkedinJobId);
    }
    if (sourceText.length < 400) {
      return { status: "needs_text" as const, canonicalUrl: parsed.canonicalUrl };
    }

    // 3. Primary resume for scoring.
    const { data: resumes } = await supabase
      .from("resumes")
      .select("id, title, content_text, is_primary")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    const resume = resumes?.[0] ?? null;

    const { aiJson } = await import("@/lib/ai.server");

    // 4. Parse the posting.
    const parsedJob = await aiJson<ParsedJob>({
      system: PARSE_SYSTEM,
      content: `Job link: ${parsed.canonicalUrl}\n\nPosting text:\n${sourceText.slice(0, 20000)}`,
    });

    // 5. Score against the resume.
    let match: MatchResult | null = null;
    if (resume?.content_text) {
      match = await aiJson<MatchResult>({
        system: SCORE_SYSTEM,
        content: `JOB POSTING\nTitle: ${parsedJob.title ?? "unknown"}\nCompany: ${
          parsedJob.company ?? "unknown"
        }\nLocation: ${parsedJob.location ?? "unknown"}\nRequirements: ${parsedJob.requirements.join(
          "; ",
        )}\nSkills: ${parsedJob.skills.join("; ")}\n\nDescription:\n${(
          parsedJob.description ?? sourceText
        ).slice(0, 8000)}\n\nCANDIDATE RESUME\n${resume.content_text.slice(0, 12000)}`,
      });
    }

    const { data: inserted, error } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        url: data.url,
        canonical_url: parsed.canonicalUrl,
        linkedin_job_id: parsed.linkedinJobId,
        title: parsedJob.title,
        company: parsedJob.company,
        location: parsedJob.location,
        workplace_type: parsedJob.workplace_type,
        employment_type: parsedJob.employment_type,
        seniority: parsedJob.seniority,
        salary: parsedJob.salary,
        description: parsedJob.description,
        requirements: parsedJob.requirements?.slice(0, 15) ?? [],
        skills: parsedJob.skills?.slice(0, 25) ?? [],
        posted_at: parsedJob.posted_at,
        source: parsed.isLinkedIn ? "linkedin" : "web",
        match_score: match ? Math.max(0, Math.min(100, Math.round(match.score))) : null,
        match_summary: match?.summary ?? null,
        strengths: match?.strengths?.slice(0, 6) ?? [],
        gaps: match?.gaps?.slice(0, 6) ?? [],
        scored_resume_id: match ? resume?.id ?? null : null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return {
      status: "created" as const,
      job: inserted,
      scored: Boolean(match),
    };
  });

export const rescoreJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => {
    if (!input?.jobId) throw new Error("Missing job.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!job) throw new Error("Job not found.");

    const { data: resumes } = await supabase
      .from("resumes")
      .select("id, content_text")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    const resume = resumes?.[0];
    if (!resume?.content_text) {
      throw new Error("Add a resume first so it can be compared.");
    }

    const { aiJson } = await import("@/lib/ai.server");
    const match = await aiJson<MatchResult>({
      system: SCORE_SYSTEM,
      content: `JOB POSTING\nTitle: ${job.title ?? ""}\nCompany: ${job.company ?? ""}\nLocation: ${
        job.location ?? ""
      }\nRequirements: ${(job.requirements ?? []).join("; ")}\nSkills: ${(job.skills ?? []).join(
        "; ",
      )}\n\nDescription:\n${(job.description ?? "").slice(0, 8000)}\n\nCANDIDATE RESUME\n${resume.content_text.slice(
        0,
        12000,
      )}`,
    });

    const { data: updated, error } = await supabase
      .from("jobs")
      .update({
        match_score: Math.max(0, Math.min(100, Math.round(match.score))),
        match_summary: match.summary,
        strengths: match.strengths?.slice(0, 6) ?? [],
        gaps: match.gaps?.slice(0, 6) ?? [],
        scored_resume_id: resume.id,
      })
      .eq("id", job.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });
