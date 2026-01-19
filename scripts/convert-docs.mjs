import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

const inputPath = process.argv[2] || 'C:\\Users\\IT_COMMS\\.gemini\\antigravity\\brain\\ab9979a9-9d6c-44a0-8199-51e0c673a676\\CRM_INTEGRATION_GUIDE.md';
const outputDir = 'C:\\Users\\IT_COMMS\\Desktop';
const docxName = 'CRM_INTEGRATION_GUIDE_v2.docx';
const pdfName = 'CRM_INTEGRATION_GUIDE_v2.pdf';

const markdown = fs.readFileSync(inputPath, 'utf-8');
const lines = markdown.split('\n');

// Helper to strip markdown formatting
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^#+\s*/, '')
    .trim();
}

// ============ CREATE DOCX ============
async function createDocx() {
  const children = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inTable = false;
  let tableRows = [];

  for (const line of lines) {
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        children.push(new Paragraph({
          children: [new TextRun({ text: codeLines.join('\n'), font: 'Consolas', size: 18 })],
          shading: { fill: 'f0f0f0' },
        }));
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Handle tables
    if (line.startsWith('|')) {
      if (line.includes('---')) continue; // Skip separator row
      const cells = line.split('|').filter(c => c.trim()).map(c => stripMarkdown(c.trim()));
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable && tableRows.length > 0) {
      // End table, create it
      const maxCols = Math.max(...tableRows.map(r => r.length));
      const tableChildren = tableRows.map((row, idx) =>
        new TableRow({
          children: row.map(cell =>
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: cell, bold: idx === 0, size: 20 })]
              })],
              width: { size: 100 / maxCols, type: WidthType.PERCENTAGE },
            })
          ),
        })
      );
      children.push(new Table({ rows: tableChildren, width: { size: 100, type: WidthType.PERCENTAGE } }));
      children.push(new Paragraph({ text: '' }));
      tableRows = [];
      inTable = false;
    }

    // Handle headings
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: stripMarkdown(line), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: stripMarkdown(line), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: stripMarkdown(line), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('#### ')) {
      children.push(new Paragraph({ text: stripMarkdown(line), heading: HeadingLevel.HEADING_4 }));
    } else if (line.startsWith('> ')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripMarkdown(line.slice(2)), italics: true })],
        indent: { left: 720 },
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({ text: '• ' + stripMarkdown(line.slice(2)), indent: { left: 360 } }));
    } else if (line.match(/^\d+\.\s/)) {
      children.push(new Paragraph({ text: stripMarkdown(line), indent: { left: 360 } }));
    } else if (line.startsWith('---')) {
      children.push(new Paragraph({ text: '─'.repeat(60), spacing: { before: 200, after: 200 } }));
    } else if (line.trim()) {
      children.push(new Paragraph({ text: stripMarkdown(line) }));
    } else {
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(outputDir, docxName);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ DOCX created: ${outputPath}`);
}

// ============ CREATE PDF ============
function createPdf() {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;
  let inCodeBlock = false;

  function addPage() {
    pdf.addPage();
    y = 20;
  }

  function checkPage(needed = 10) {
    if (y + needed > 280) addPage();
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    checkPage();

    const text = stripMarkdown(line);

    if (line.startsWith('# ')) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(text, margin, y);
      y += 10;
    } else if (line.startsWith('## ')) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(text, margin, y);
      y += 8;
    } else if (line.startsWith('### ')) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(text, margin, y);
      y += 7;
    } else if (line.startsWith('---')) {
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
    } else if (inCodeBlock) {
      pdf.setFontSize(9);
      pdf.setFont('courier', 'normal');
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y - 4, maxWidth, 6, 'F');
      pdf.text(line.slice(0, 90), margin + 2, y);
      y += 5;
    } else if (line.startsWith('|')) {
      if (!line.includes('---')) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(text.replace(/\|/g, '  |  ').slice(0, 100), margin, y);
        y += 5;
      }
    } else if (text) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const splitText = pdf.splitTextToSize(text, maxWidth);
      for (const t of splitText) {
        checkPage();
        pdf.text(t, margin, y);
        y += 5;
      }
    } else {
      y += 3;
    }
  }

  const outputPath = path.join(outputDir, pdfName);
  pdf.save(outputPath);
  console.log(`✅ PDF created: ${outputPath}`);
}

// Run both
await createDocx();
createPdf();
console.log('\n📁 Files saved to Desktop');
