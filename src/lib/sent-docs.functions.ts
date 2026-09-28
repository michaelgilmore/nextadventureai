import { createServerFn } from "@tanstack/react-start";
import { unzipSync, strFromU8 } from "fflate";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "resume" | "cover_letter";

function b64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function xmlToText(xml: string, paraTag: RegExp): string {
  return xml
    .replace(paraTag, "\n")
    .replace(/<w:tab\/>|<text:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(fileName: string, mime: string, base64: string): Promise<string> {
  const name = fileName.toLowerCase();
  if (mime.startsWith("text/") || /\.(txt|md)$/.test(name)) {
    return new TextDecoder().decode(b64ToBytes(base64)).trim();
  }
  if (name.endsWith(".docx")) {
    const files = unzipSync(b64ToBytes(base64), { filter: (f) => f.name === "word/document.xml" });
    const xml = files["word/document.xml"];
    if (!xml) throw new Error("That .docx file looks empty.");
    return xmlToText(strFromU8(xml), /<\/w:p>/g);
  }
  if (name.endsWith(".odt")) {
    const files = unzipSync(b64ToBytes(base64), { filter: (f) => f.name === "content.xml" });
    const xml = files["content.xml"];
    if (!xml) throw new Error("That .odt file looks empty.");
    return xmlToText(strFromU8(xml), /<\/text:(p|h)>/g);
  }
  if (name.endsWith(".pdf") || mime === "application/pdf") {
    const { aiJson } = await import("@/lib/ai.server");
    const result = await aiJson<{ text: string }>({
      system: 'You read a document and return its full text. Return ONLY JSON: {"text": string} with the complete content as plain text.',
      content: [
        { type: "text", text: "Extract the full text of this document." },
        { type: "file", file: { filename: fileName, file_data: `data:application/pdf;base64,${base64}` } },
      ],
    });
    return (result.text ?? "").trim();
  }
  throw new Error("Upload a .docx, .odt, .pdf or .txt file.");
}

export const uploadSentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { jobId: string; kind: Kind; fileName: string; mimeType: string; base64: string; includeInFuture: boolean }) => {
      if (!input?.jobId || !input.base64) throw new Error("Choose a file to upload.");
      return { ...input, kind: input.kind === "cover_letter" ? ("cover_letter" as const) : ("resume" as const) };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const text = await extractText(data.fileName, data.mimeType, data.base64);
    if (text.length < 50) throw new Error("Couldn't read enough text from that file.");
    const { error } = await supabase.from("sent_documents").upsert(
      {
        user_id: userId,
        job_id: data.jobId,
        kind: data.kind,
        file_name: data.fileName,
        content_text: text,
        include_in_future: Boolean(data.includeInFuture),
      },
      { onConflict: "job_id,kind" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
