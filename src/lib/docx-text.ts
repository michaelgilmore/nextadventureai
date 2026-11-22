import { strFromU8, unzipSync } from "fflate";

const DOCX_TEXT_FILE = /^word\/(?:document|header\d*)\.xml$/;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlToText(xml: string): string {
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];

  return paragraphs
    .map((paragraph) => {
      const isListItem = /<w:numPr\b/.test(paragraph);
      const text = decodeXmlEntities(
        paragraph
          .replace(/<w:tab\b[^>]*\/>/g, "\t")
          .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
          .replace(/<w:noBreakHyphen\b[^>]*\/>/g, "-")
          .replace(/<[^>]+>/g, ""),
      )
        .replace(/\u00a0/g, " ")
        .replace(/ {2,}/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .trim();

      if (!text) return "";
      return isListItem ? `• ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

/** Extract editable resume text from the body and headers of a DOCX file. */
export function extractDocxText(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => DOCX_TEXT_FILE.test(file.name) });
  } catch {
    throw new Error("That DOCX file couldn't be opened. Try saving a fresh copy and uploading it again.");
  }

  if (!files["word/document.xml"]) {
    throw new Error("That DOCX file doesn't contain a readable Word document.");
  }

  const names = Object.keys(files).sort((a, b) => {
    if (a === "word/document.xml") return 1;
    if (b === "word/document.xml") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return names
    .map((name) => xmlToText(strFromU8(files[name]!)))
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
