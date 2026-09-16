import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXTRACT_SYSTEM = `You read a resume file and return its full text.
Return ONLY JSON: {"text": string}
"text" is the complete resume content as clean plain text, preserving section headings, roles, dates, bullet points and skills. Do not summarize or omit anything.`;

function decodeBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const saveResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      fileName?: string | undefined;
      mimeType?: string | undefined;
      base64?: string | undefined;
      text?: string | undefined;
      makePrimary?: boolean | undefined;
    }) => {
      if (!input?.title?.trim()) throw new Error("Give the resume a name.");
      if (!input.base64 && !input.text?.trim()) throw new Error("Upload a file or paste your resume text.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let text = data.text?.trim() ?? "";

    if (!text && data.base64) {
      const mime = data.mimeType ?? "";
      if (mime.startsWith("text/") || /\.(txt|md|markdown)$/i.test(data.fileName ?? "")) {
        text = decodeBase64(data.base64).trim();
      } else if (mime === "application/pdf" || /\.pdf$/i.test(data.fileName ?? "")) {
        const { aiJson } = await import("@/lib/ai.server");
        const result = await aiJson<{ text: string }>({
          system: EXTRACT_SYSTEM,
          content: [
            { type: "text", text: "Extract the full text of this resume." },
            {
              type: "file",
              file: {
                filename: data.fileName ?? "resume.pdf",
                file_data: `data:application/pdf;base64,${data.base64}`,
              },
            },
          ],
        });
        text = (result.text ?? "").trim();
      } else {
        throw new Error(
          "That file type isn't supported. Upload a PDF or a plain text file, or paste the text instead.",
        );
      }
    }

    if (text.length < 200) {
      throw new Error("Couldn't read enough text from that file. Try a PDF or paste the text instead.");
    }

    const { count } = await supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const makePrimary = data.makePrimary ?? (count ?? 0) === 0;
    if (makePrimary) {
      await supabase.from("resumes").update({ is_primary: false }).eq("user_id", userId);
    }

    const { data: inserted, error } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        file_name: data.fileName ?? null,
        content_text: text,
        is_primary: makePrimary,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

export const setPrimaryResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string }) => {
    if (!input?.resumeId) throw new Error("Missing resume.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("resumes").update({ is_primary: false }).eq("user_id", userId);
    const { error } = await supabase
      .from("resumes")
      .update({ is_primary: true })
      .eq("id", data.resumeId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
