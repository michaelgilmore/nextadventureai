import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat,
  PageNumber, Paragraph, TextRun,
} from "docx";

export type DocumentKind = "resume" | "cover_letter";
type Block = { text: string; kind: "body" | "heading" | "bullet" };
const sectionNames = /^(professional summary|summary|profile|objective|professional experience|work experience|experience|employment history|education|skills|technical skills|core competencies|certifications|projects|awards|volunteer experience|additional information|publications|professional development)$/i;

function parse(text: string, kind: DocumentKind) {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  let end = lines.findIndex((line) => !line.trim());
  if (end < 1 || end > 7) {
    end = 1;
    while (end < Math.min(lines.length, 7) && /@|https?:|www\.|linkedin|\d{3}.*\d{3}|\||\b(?:phone|email|address)\b/i.test(lines[end] ?? "")) end++;
  }
  const header = lines.slice(0, end).map((line) => line.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (const raw of lines.slice(end)) {
    const line = raw.trim();
    if (!line) {
      if (kind === "cover_letter") blocks.push({ text: "", kind: "body" });
      continue;
    }
    const clean = line.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "");
    const bullet = /^[-•*]\s+/.test(clean);
    const heading = kind === "resume" && !bullet && (sectionNames.test(clean.replace(/:$/, "")) || (clean.length <= 60 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)));
    blocks.push({ text: bullet ? clean.replace(/^[-•*]\s+/, "") : clean, kind: bullet ? "bullet" : heading ? "heading" : "body" });
  }
  // In a letter, hard line wrapping within a paragraph is not a paragraph break.
  if (kind === "cover_letter") {
    const paragraphs: Block[] = [];
    let group: string[] = [];
    const flush = () => { if (group.length) paragraphs.push({ text: group.join(" "), kind: "body" }); group = []; };
    for (const block of blocks) { if (!block.text) flush(); else group.push(block.text); }
    flush();
    return { header, blocks: paragraphs };
  }
  return { header, blocks };
}

// Conservative Arial width estimate, usable in both browsers and tests.
function lineCount(text: string, font: number, width: number) {
  const measure = (value: string) => Array.from(value).reduce((sum, c) => sum + (/[^\x00-\x7F]/.test(c) ? 1 : /[MW@%]/.test(c) ? .95 : /[ilI.,'!:;|]/.test(c) ? .3 : /[A-Z0-9]/.test(c) ? .68 : .55), 0) * font;
  let lines = 1, used = 0;
  for (const word of text.split(/\s+/)) {
    const length = measure(word) + font * .3;
    if (used && used + length > width) { lines++; used = 0; }
    if (length > width) { lines += Math.ceil(length / width) - 1; used = length % width; }
    else used += length;
  }
  return lines;
}

export function buildApplicationDocument(text: string, kind: DocumentKind) {
  if (!text.trim()) throw new Error("Generate a document before downloading.");
  const { header, blocks } = parse(text, kind);
  const letter = kind === "cover_letter";
  const margin = letter ? 1080 : 900; // 0.75 / 0.625 inch, US Letter.
  const width = (12240 - margin * 2) / 20;
  const capacity = (15840 - margin * 2) / 20 - 28;
  let chosen: { font: number; split: number } | undefined;
  for (const font of letter ? [11, 10.5] : [11, 10.5]) {
    const headerHeight = header.reduce((sum, line, i) => sum + lineCount(line, i ? 10 : 20, width) * (i ? 12 : 24) + 3, 14);
    const heights = blocks.map((block) => lineCount(block.text, block.kind === "heading" ? 11 : font, width - (block.kind === "bullet" ? 16 : 0)) * font * 1.2 + (block.kind === "heading" ? 15 : letter ? 9 : 5));
    const total = heights.reduce((a, b) => a + b, 0);
    if (headerHeight + total <= capacity) { chosen = { font, split: blocks.length }; break; }
    if (letter) continue;
    let before = 0, best: { split: number; difference: number } | undefined;
    for (let i = 1; i < blocks.length; i++) {
      before += heights[i - 1] ?? 0;
      if (blocks[i - 1]?.kind === "heading") continue; // Never orphan a section heading.
      const after = total - before;
      if (headerHeight + before > capacity || headerHeight + after > capacity) continue;
      const difference = Math.abs(before - after) + (blocks[i]?.kind === "heading" ? 0 : 35);
      if (!best || difference < best.difference) best = { split: i, difference };
    }
    if (best) { chosen = { font, split: best.split }; break; }
  }
  if (!chosen) throw new Error(`This ${letter ? "cover letter is too long for one page" : "resume is too long for two pages"}. Shorten the text or regenerate before downloading; no content has been removed.`);
  const { font, split } = chosen;
  const name = header[0] ?? "";
  const headerParagraphs = () => header.map((line, i) => new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { after: i === header.length - 1 ? 180 : 40 },
    ...(i === header.length - 1 ? { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "777777", space: 8 } } } : {}),
    children: [new TextRun({ text: line, size: i ? 20 : 40, bold: i === 0 })],
  }));
  const paragraph = (block: Block) => new Paragraph({
    ...(block.kind === "heading" ? { heading: HeadingLevel.HEADING_2 } : {}),
    ...(block.kind === "bullet" ? { numbering: { reference: "resume-bullets", level: 0 } } : {}),
    keepNext: block.kind === "heading",
    keepLines: true,
    widowControl: true,
    spacing: { before: block.kind === "heading" ? 140 : 0, after: block.kind === "heading" ? 60 : letter ? 180 : 80, line: Math.round(font * 24) },
    children: [new TextRun({ text: block.text, bold: block.kind === "heading", size: block.kind === "heading" ? 22 : font * 2 })],
  });
  const children: Paragraph[] = [...headerParagraphs(), ...blocks.slice(0, split).map(paragraph)];
  if (split < blocks.length) {
    children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 140 }, children: [new TextRun({ text: `${name} — continued`, bold: true, size: 22 })] }));
    children.push(...blocks.slice(split).map(paragraph));
  }
  return new Document({
    creator: "NextAdventureAI", title: letter ? "Custom cover letter" : "Custom resume",
    styles: {
      default: { document: { run: { font: "Arial", size: font * 2, color: "000000" } } },
      paragraphStyles: [{ id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 22, bold: true, color: "000000" }, paragraph: { outlineLevel: 1 } }],
    },
    numbering: { config: [{ reference: "resume-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 240, hanging: 180 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: margin, right: margin, bottom: margin, left: margin, footer: 400 } } },
      ...(!letter ? { footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Page ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 }), new TextRun({ text: " of ", size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })] })] }) } } : {}),
      children,
    }],
  });
}