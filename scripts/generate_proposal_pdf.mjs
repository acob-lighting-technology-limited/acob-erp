import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

const inputPath = '/Users/chibuike/.gemini/antigravity/brain/9119259c-6c73-4f8c-a2a2-7c8735091661/implementation_plan.md';
const outputDir = '/Users/chibuike/Documents/GitHub/clone/ERP';
const pdfName = 'Ticketing_Performance_Tracking_System_Proposal.pdf';

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

const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const margin = 20;
const maxWidth = pageWidth - margin * 2;
let y = 30;

function checkPage(needed = 15) {
  if (y + needed > 270) {
    pdf.addPage();
    y = 25;
    return true;
  }
  return false;
}

// Custom Title Header (First Page)
pdf.setFillColor(0, 102, 51); // Professional Dark Green
pdf.rect(0, 0, pageWidth, 50, 'F');
pdf.setTextColor(255, 255, 255);
pdf.setFontSize(22);
pdf.setFont('helvetica', 'bold');
pdf.text('STRATEGIC PROPOSAL: TICKETING', margin, 20);
pdf.text('& PERFORMANCE TRACKING SYSTEM', margin, 32);

pdf.setFontSize(10);
pdf.setFont('helvetica', 'normal');
pdf.text('ACOB Lighting Technology Limited', margin, 42);

y = 65;
pdf.setTextColor(0, 0, 0);

let inTable = false;
let tableRows = [];

for (const line of lines) {
  const text = stripMarkdown(line);
  
  // Handle Tables Manually
  if (line.trim().startsWith('|')) {
    if (line.includes('---')) continue;
    const cells = line.split('|').filter(c => c.trim() !== '').map(c => stripMarkdown(c.trim()));
    tableRows.push(cells);
    inTable = true;
    continue;
  } else if (inTable && tableRows.length > 0) {
    checkPage(tableRows.length * 10 + 10);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Header
    let currentX = margin;
    const colWidth = maxWidth / tableRows[0].length;
    
    pdf.setFillColor(230, 245, 230); // Light Green Tint
    pdf.rect(margin, y - 5, maxWidth, 8, 'F');
    
    tableRows[0].forEach(cell => {
      pdf.text(cell, currentX + 2, y);
      currentX += colWidth;
    });
    
    y += 8;
    pdf.setFont('helvetica', 'normal');
    
    // Body
    tableRows.slice(1).forEach(row => {
      currentX = margin;
      row.forEach(cell => {
        const wrapped = pdf.splitTextToSize(cell, colWidth - 4);
        pdf.text(wrapped, currentX + 2, y);
        currentX += colWidth;
      });
      y += 8;
    });
    
    y += 5;
    tableRows = [];
    inTable = false;
  }

  if (line.startsWith('## ')) {
    checkPage(20);
    y += 8;
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 128, 0); // Green
    pdf.text(text, margin, y);
    y += 10;
    pdf.setTextColor(0, 0, 0);
    continue;
  }

  if (line.startsWith('### ')) {
    checkPage(12);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(text, margin, y);
    y += 8;
    continue;
  }

  if (line.startsWith('- ') || line.startsWith('* ')) {
    checkPage(8);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text('•', margin, y);
    const bulletText = pdf.splitTextToSize(text, maxWidth - 8);
    pdf.text(bulletText, margin + 8, y);
    y += (bulletText.length * 6);
    continue;
  }

  if (line.startsWith('---')) {
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;
    continue;
  }

  if (text && !inTable) {
    checkPage(10);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const splitText = pdf.splitTextToSize(text, maxWidth);
    pdf.text(splitText, margin, y);
    y += (splitText.length * 6);
  } else if (!text && !inTable) {
    y += 4;
  }
}

// Add Page Numbering at the end
const pageCount = pdf.internal.getNumberOfPages();
for (let i = 1; i <= pageCount; i++) {
  pdf.setPage(i);
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Page ${i} of ${pageCount} | Strategic Proposal: Internal Service Management`, margin, 285);
  pdf.text('Confidential - ACOB Lighting Technology Limited', pageWidth - margin - 80, 285);
}

const outputPath = path.join(outputDir, pdfName);
pdf.save(outputPath);
console.log(`Successfully generated PDF: ${outputPath}`);
