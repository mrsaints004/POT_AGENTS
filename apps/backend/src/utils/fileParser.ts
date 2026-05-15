import { parse } from "csv-parse/sync";

export async function parseFile(buffer: Buffer, mimetype: string): Promise<string> {
  switch (mimetype) {
    case "application/pdf":
      return parsePdf(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(buffer);
    case "text/csv":
      return parseCsv(buffer);
    case "text/plain":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: ${mimetype}`);
  }
}

/** Text-only PDF parsing (no canvas) — safe for Vercel serverless. */
async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(text);
  }

  await doc.destroy();
  return parts.join("\n").trim();
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseCsv(buffer: Buffer): string {
  const records = parse(buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  if (records.length === 0) return "";

  const headers = Object.keys(records[0]);
  const headerRow = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const rows = records.map((r) => `| ${headers.map((h) => r[h] ?? "").join(" | ")} |`);

  return [headerRow, separator, ...rows].join("\n");
}
