import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

/** A small, believable PDF: title, company, a few lines of body text, a footer. */
export async function samplePdf(params: { title: string; company: string; lines: string[] }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.06, 0.12, 0.24);
  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: navy });
  page.drawText(params.company, { x: 40, y: 816, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(params.title, { x: 40, y: 760, size: 18, font: bold, color: navy });
  let y = 720;
  for (const line of params.lines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.15, 0.18, 0.25) });
    y -= 18;
  }
  page.drawLine({ start: { x: 40, y: 80 }, end: { x: 555, y: 80 }, thickness: 0.5, color: rgb(0.7, 0.74, 0.8) });
  page.drawText("Sample document generated for the V ACT Client Portal demo. Not a real record.", {
    x: 40,
    y: 62,
    size: 8,
    font,
    color: rgb(0.45, 0.5, 0.58),
  });
  return Buffer.from(await pdf.save());
}

/** A "phone photo" of a document: a light card on a dark background with a few text lines, ~1200×800. */
export async function sampleJpg(params: { title: string; company: string }): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="#4a4f57"/>
    <rect x="110" y="90" width="980" height="620" rx="24" fill="#f3efe6" transform="rotate(-2 600 400)"/>
    <rect x="150" y="130" width="300" height="200" rx="12" fill="#d9d2c3" transform="rotate(-2 600 400)"/>
    <text x="490" y="190" font-family="Helvetica, Arial" font-size="34" font-weight="bold" fill="#0f1f3d" transform="rotate(-2 600 400)">${esc(params.title)}</text>
    <text x="490" y="240" font-family="Helvetica, Arial" font-size="24" fill="#2b3346" transform="rotate(-2 600 400)">${esc(params.company)}</text>
    <text x="490" y="300" font-family="Helvetica, Arial" font-size="20" fill="#5b6475" transform="rotate(-2 600 400)">Sample scan for the V ACT Client Portal demo</text>
    <rect x="150" y="380" width="880" height="18" rx="9" fill="#cfc8b8" transform="rotate(-2 600 400)"/>
    <rect x="150" y="420" width="760" height="18" rx="9" fill="#cfc8b8" transform="rotate(-2 600 400)"/>
    <rect x="150" y="460" width="820" height="18" rx="9" fill="#cfc8b8" transform="rotate(-2 600 400)"/>
    <rect x="150" y="540" width="420" height="18" rx="9" fill="#cfc8b8" transform="rotate(-2 600 400)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
