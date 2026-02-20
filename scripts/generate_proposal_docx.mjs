import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, Header, Footer } from 'docx';
import fs from 'fs';
import path from 'path';

const inputPath = '/Users/chibuike/.gemini/antigravity/brain/9119259c-6c73-4f8c-a2a2-7c8735091661/implementation_plan.md';
const outputDir = '/Users/chibuike/Documents/GitHub/clone/ERP';
const docxName = 'Ticketing_Performance_Tracking_System_Proposal.docx';

const markdown = fs.readFileSync(inputPath, 'utf-8');
const lines = markdown.split('\n');

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^#+\s*/, '')
    .trim();
}

async function createDocx() {
  const children = [];
  let inTable = false;
  let tableRows = [];

  // Title Section with Green Background (simulated with a one-cell table for full-width color or just styling)
  children.push(new Paragraph({
    text: "STRATEGIC PROPOSAL: TICKETING & PERFORMANCE TRACKING SYSTEM",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "ACOB Lighting Technology Limited", size: 24, italics: true }),
    ],
    spacing: { after: 800 },
  }));

  for (const line of lines) {
    const text = stripMarkdown(line);

    // Handle Tables
    if (line.trim().startsWith('|')) {
      if (line.includes('---')) continue;
      const cells = line.split('|').filter(c => c.trim() !== '').map(c => stripMarkdown(c.trim()));
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable && tableRows.length > 0) {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows.map((row, idx) => 
          new TableRow({
            children: row.map(cell => 
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cell, bold: idx === 0, size: 20 })],
                })],
                shading: idx === 0 ? { fill: "E6F5E6" } : undefined,
              })
            ),
          })
        ),
      });
      children.push(table);
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      tableRows = [];
      inTable = false;
    }

    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }));
      continue;
    }

    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        text: text,
        bullet: { level: 0 },
        spacing: { after: 100 },
      }));
      continue;
    }

    if (line.startsWith('---')) {
      children.push(new Paragraph({
        border: { bottom: { color: "C8C8C8", space: 1, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { before: 200, after: 400 },
      }));
      continue;
    }

    if (text && !inTable) {
      if (line.startsWith('# ')) continue; // Skip title if it's the main H1 we already did
      children.push(new Paragraph({
        text: text,
        spacing: { after: 200 },
      }));
    } else if (!text && !inTable) {
      // children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Strategic Proposal: Internal Service Management", size: 18, color: "969696" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Confidential - ACOB Lighting Technology Limited | Page ", size: 18, color: "969696" }),
                new TextRun({ children: ["PAGE_NUMBER"], size: 18, color: "969696" }),
                new TextRun({ text: " of ", size: 18, color: "969696" }),
                new TextRun({ children: ["NUM_PAGES"], size: 18, color: "969696" }),
              ],
            }),
          ],
        }),
      },
      children: children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(outputDir, docxName);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Successfully generated DOCX: ${outputPath}`);
}

createDocx();
