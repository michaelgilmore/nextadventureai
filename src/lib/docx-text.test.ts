import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { extractDocxText } from "./docx-text";

function makeDocx(documentXml: string, headerXml?: string): Uint8Array {
  return zipSync({
    "word/document.xml": strToU8(documentXml),
    ...(headerXml ? { "word/header1.xml": strToU8(headerXml) } : {}),
  });
}

describe("extractDocxText", () => {
  it("reads DOCX body text, lists, tabs, entities, and contact headers", () => {
    const bytes = makeDocx(
      `<w:document><w:body>
        <w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>Built APIs &amp; led migrations</w:t></w:r></w:p>
        <w:p><w:r><w:t>Senior Engineer</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>2020&#x2013;2026</w:t></w:r></w:p>
      </w:body></w:document>`,
      `<w:hdr><w:p><w:r><w:t>Michael Gilmore</w:t></w:r></w:p><w:p><w:r><w:t>mike@example.com</w:t></w:r></w:p></w:hdr>`,
    );

    expect(extractDocxText(bytes)).toBe(
      "Michael Gilmore\nmike@example.com\n\nEXPERIENCE\n• Built APIs & led migrations\nSenior Engineer\t2020–2026",
    );
  });

  it("rejects ZIP files without a Word document body", () => {
    const bytes = zipSync({ "word/header1.xml": strToU8("<w:hdr/>") });
    expect(() => extractDocxText(bytes)).toThrow("doesn't contain a readable Word document");
  });
});
