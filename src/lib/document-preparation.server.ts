import { Packer } from "docx";
import { buildApplicationDocument, DocumentLengthError, type DocumentKind } from "./application-docx";

type GenerateText = (args: { instructions: string; input: string }) => Promise<string>;

// A successful result always contains a fully formatted file, never an unchecked draft.
export async function prepareApplicationDocument(args: {
  kind: DocumentKind;
  instructions: string;
  input: string;
  generateText: GenerateText;
}) {
  let text = await args.generateText({ instructions: args.instructions, input: args.input });
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const document = buildApplicationDocument(text, args.kind);
      const docxBase64 = await Packer.toBase64String(document);
      return { text, docxBase64 };
    } catch (error) {
      if (!(error instanceof DocumentLengthError)) throw error;
      if (attempt === 2) {
        throw new Error("The document could not be fitted to the required page limit. Please generate it again; no unfinished file has been shown.");
      }
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const target = Math.min(args.kind === "cover_letter" ? 300 : 700, Math.floor(wordCount * (attempt === 0 ? 0.75 : 0.6)));
      text = await args.generateText({
        instructions: args.instructions + `\nThe previous draft did not fit the required ${args.kind === "cover_letter" ? "one-page" : "two-page"} layout. Rewrite it more concisely, aiming for at most ${target} words including the header. Preserve the candidate's entire original contact header verbatim, essential employment history and dates, degrees, qualifications, and factual accuracy. Consolidate repetitive wording and prioritize relevant achievements; do not cut off text, invent facts, or remove essential information. Reduce excessive short lines and redundant sections. Return only the complete revised document.`,
        input: `${args.input}\n\nPREVIOUS DRAFT TO REVISE (not new evidence)\n${text}`,
      });
    }
  }
  throw new Error("Could not prepare the document.");
}