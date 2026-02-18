import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { saveAs } from "file-saver"
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx"
import JSZip from "jszip"
import PptxGenJS from "pptxgenjs"

// Helper to ensure JSZip is available globally (required for pptxgenjs)
const ensureJSZip = () => {
  if (typeof window !== "undefined" && !(window as any).JSZip) {
    ;(window as any).JSZip = JSZip
  }
}

interface WeeklyReport {
  id: string
  department: string
  week_number: number
  year: number
  work_done: string
  tasks_new_week: string
  challenges: string
  status: string
  user_id: string
  created_at: string
  profiles?: any
}

export const exportToPDF = async (report: WeeklyReport) => {
  const doc = new jsPDF()
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  // Header
  doc.setFontSize(22)
  doc.setTextColor(37, 99, 235) // blue-600
  doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", 105, 20, { align: "center" })

  doc.setFontSize(16)
  doc.setTextColor(71, 85, 105) // slate-600
  doc.text("Weekly Departmental Progress Report", 105, 30, { align: "center" })

  const metaData = [
    ["Department", report.department],
    ["Employee", name],
    ["Period", `Week ${report.week_number}, ${report.year}`],
    ["Date Generated", new Date().toLocaleDateString()],
  ]

  const autoTableFn = (autoTable as any).default || autoTable
  if (typeof autoTableFn === "function") {
    autoTableFn(doc, {
      startY: 40,
      head: [["Field", "Details"]],
      body: metaData,
      theme: "grid",
      headStyles: { fillStyle: "F1F5F9", textColor: "#1E293B", fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 5 },
    })
  } else {
    ;(doc as any).autoTable({
      startY: 40,
      head: [["Field", "Details"]],
      body: metaData,
      theme: "grid",
      headStyles: { fillStyle: "F1F5F9", textColor: "#1E293B", fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 5 },
    })
  }

  let finalY = (doc as any).lastAutoTable.finalY + 10

  const sections = [
    { title: "WORK ACCOMPLISHED", content: report.work_done, color: [37, 99, 235] },
    { title: "UPCOMING OBJECTIVES", content: report.tasks_new_week, color: [16, 185, 129] },
    { title: "CRITICAL BLOCKERS", content: report.challenges, color: [239, 68, 68] },
  ]

  sections.forEach((section) => {
    if (finalY > 250) {
      doc.addPage()
      finalY = 20
    }

    doc.setFontSize(12)
    //@ts-expect-error: jspdf setTextColor supports spreading an array of numbers
    doc.setTextColor(...section.color)
    doc.setFont("helvetica", "bold")
    doc.text(section.title, 14, finalY)

    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59) // slate-800
    doc.setFont("helvetica", "normal")

    const splitText = doc.splitTextToSize(section.content || "No data provided", 180)
    doc.text(splitText, 14, finalY + 7)
    finalY += splitText.length * 5 + 20
  })

  doc.save(`ACOB_Report_${report.department}_W${report.week_number}.pdf`)
}

export const exportAllToPDF = async (reports: WeeklyReport[], week: number, year: number) => {
  const doc = new jsPDF()

  reports.forEach((report, index) => {
    if (index > 0) doc.addPage()

    const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
    const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

    // Header
    doc.setFontSize(22)
    doc.setTextColor(37, 99, 235)
    doc.text("ACOB LIGHTING TECHNOLOGY LIMITED", 105, 20, { align: "center" })

    doc.setFontSize(16)
    doc.setTextColor(71, 85, 105)
    doc.text(`${report.department} - Weekly Report`, 105, 30, { align: "center" })

    const metaData = [
      ["Department", report.department],
      ["Employee", name],
      ["Period", `Week ${report.week_number}, ${report.year}`],
      ["Date Generated", new Date().toLocaleDateString()],
    ]

    const autoTableFn = (autoTable as any).default || autoTable
    if (typeof autoTableFn === "function") {
      autoTableFn(doc, {
        startY: 40,
        head: [["Field", "Details"]],
        body: metaData,
        theme: "grid",
        headStyles: { fillStyle: "F1F5F9", textColor: "#1E293B", fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 5 },
      })
    } else {
      ;(doc as any).autoTable({
        startY: 40,
        head: [["Field", "Details"]],
        body: metaData,
        theme: "grid",
        headStyles: { fillStyle: "F1F5F9", textColor: "#1E293B", fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 5 },
      })
    }

    let finalY = (doc as any).lastAutoTable.finalY + 10

    const sections = [
      { title: "WORK ACCOMPLISHED", content: report.work_done, color: [37, 99, 235] },
      { title: "UPCOMING OBJECTIVES", content: report.tasks_new_week, color: [16, 185, 129] },
      { title: "CRITICAL BLOCKERS", content: report.challenges, color: [239, 68, 68] },
    ]

    sections.forEach((section) => {
      if (finalY > 250) {
        doc.addPage()
        finalY = 20
      }
      doc.setFontSize(12)
      //@ts-expect-error: jspdf setTextColor supports spreading an array of numbers
      doc.setTextColor(...section.color)
      doc.setFont("helvetica", "bold")
      doc.text(section.title, 14, finalY)
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.setFont("helvetica", "normal")
      const splitText = doc.splitTextToSize(section.content || "No data provided", 180)
      doc.text(splitText, 14, finalY + 7)
      finalY += splitText.length * 5 + 20
    })
  })

  doc.save(`ACOB_Weekly_Reports_All_W${week}_${year}.pdf`)
}

export const exportToDocx = async (report: WeeklyReport) => {
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "ACOB LIGHTING TECHNOLOGY LIMITED",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Weekly Departmental Progress Report",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Department")],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph(report.department)],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Employee")] }),
                  new TableCell({ children: [new Paragraph(name)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Period")] }),
                  new TableCell({ children: [new Paragraph(`Week ${report.week_number}, ${report.year}`)] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "WORK ACCOMPLISHED", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: report.work_done }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "UPCOMING OBJECTIVES", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: report.tasks_new_week }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "CRITICAL BLOCKERS", heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: report.challenges }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `ACOB_Report_${report.department}_W${report.week_number}.docx`)
}

export const exportAllToDocx = async (reports: WeeklyReport[], week: number, year: number) => {
  const children: any[] = [
    new Paragraph({
      text: "ACOB LIGHTING TECHNOLOGY LIMITED",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: "CONSOLIDATED WEEKLY DEPARTMENTAL REPORTS",
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Week ${week}, ${year}`,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" }),
  ]

  reports.forEach((report) => {
    const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
    const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

    children.push(
      new Paragraph({ text: report.department, heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
      new Paragraph({ text: `Submitted by: ${name}` }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "WORK ACCOMPLISHED", heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: report.work_done }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "UPCOMING OBJECTIVES", heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: report.tasks_new_week }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "CRITICAL BLOCKERS", heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ text: report.challenges }),
      new Paragraph({ text: "" })
    )
  })

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `ACOB_Weekly_Reports_All_W${week}_${year}.docx`)
}

export const exportToPPTX = async (report: WeeklyReport) => {
  ensureJSZip()
  const PptxConstructor = (PptxGenJS as any).default || PptxGenJS
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"
  const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

  // Title Slide
  const slide1 = pres.addSlide()
  slide1.background = { color: "#F8FAFC" }
  slide1.addText("ACOB LIGHTING TECHNOLOGY LIMITED", {
    x: 0,
    y: 1.2,
    w: "100%",
    h: 0.6,
    align: "center",
    fontSize: 32,
    color: "#1E293B",
    bold: true,
  })
  slide1.addText("Weekly Departmental Progress Report", {
    x: 0,
    y: 1.8,
    w: "100%",
    h: 0.4,
    align: "center",
    fontSize: 24,
    color: "#2563EB",
  })
  slide1.addText(`${report.department} | ${name}`, {
    x: 0,
    y: 2.8,
    w: "100%",
    h: 0.3,
    align: "center",
    fontSize: 18,
    color: "#64748B",
  })
  slide1.addText(`Week ${report.week_number}, ${report.year}`, {
    x: 0,
    y: 3.2,
    w: "100%",
    h: 0.3,
    align: "center",
    fontSize: 18,
    color: "#64748B",
  })

  // Data Slides
  const sections = [
    { title: "Work Accomplished", content: report.work_done, iconColor: "2563EB" },
    { title: "Upcoming Objectives", content: report.tasks_new_week, iconColor: "10B981" },
    { title: "Critical Blockers", content: report.challenges, iconColor: "EF4444" },
  ]

  sections.forEach((section) => {
    const slide = pres.addSlide()
    slide.addText(section.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: section.iconColor,
    })
    slide.addText(section.content || "No data provided", {
      x: 0.5,
      y: 1.2,
      w: 12,
      h: 5.5,
      fontSize: 16,
      color: "#334155",
      valign: "top",
      bullet: true,
    })
  })

  await pres.writeFile({ fileName: `ACOB_Report_${report.department}_W${report.week_number}.pptx` })
}

export const exportAllToPPTX = async (reports: WeeklyReport[], week: number, year: number) => {
  ensureJSZip()
  const PptxConstructor = (PptxGenJS as any).default || PptxGenJS
  const pres = new PptxConstructor()
  pres.layout = "LAYOUT_WIDE"

  // Title Slide
  const slide1 = pres.addSlide()
  slide1.background = { color: "#F8FAFC" }
  slide1.addText("ACOB LIGHTING TECHNOLOGY LIMITED", {
    x: 0,
    y: 1.2,
    w: "100%",
    h: 0.6,
    align: "center",
    fontSize: 32,
    color: "#1E293B",
    bold: true,
  })
  slide1.addText("Consolidated Weekly Progress Reports", {
    x: 0,
    y: 1.8,
    w: "100%",
    h: 0.4,
    align: "center",
    fontSize: 24,
    color: "#2563EB",
  })
  slide1.addText(`Week ${week}, ${year}`, {
    x: 0,
    y: 2.8,
    w: "100%",
    h: 0.3,
    align: "center",
    fontSize: 18,
    color: "#64748B",
  })

  reports.forEach((report) => {
    const p = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
    const name = p ? `${p.first_name} ${p.last_name}` : "Employee"

    // Department Section Slide
    const sectionSlide = pres.addSlide()
    sectionSlide.background = { color: "#2563EB" }
    sectionSlide.addText(report.department, {
      x: 0,
      y: 2.5,
      w: "100%",
      h: 1,
      align: "center",
      fontSize: 44,
      color: "#FFFFFF",
      bold: true,
    })
    sectionSlide.addText(`Submitted by: ${name}`, {
      x: 0,
      y: 3.5,
      w: "100%",
      h: 0.5,
      align: "center",
      fontSize: 20,
      color: "#E2E8F0",
    })

    // Data Slides
    const sections = [
      { title: "Work Accomplished", content: report.work_done, iconColor: "2563EB" },
      { title: "Upcoming Objectives", content: report.tasks_new_week, iconColor: "10B981" },
      { title: "Critical Blockers", content: report.challenges, iconColor: "EF4444" },
    ]

    sections.forEach((section) => {
      const slide = pres.addSlide()
      slide.addText(`${report.department}: ${section.title}`, {
        x: 0.5,
        y: 0.4,
        w: 9,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: section.iconColor,
      })
      slide.addText(section.content || "No data provided", {
        x: 0.5,
        y: 1.2,
        w: 12,
        h: 5.5,
        fontSize: 16,
        color: "#334155",
        valign: "top",
        bullet: true,
      })
    })
  })

  await pres.writeFile({ fileName: `ACOB_Weekly_Reports_All_W${week}_${year}.pptx` })
}
