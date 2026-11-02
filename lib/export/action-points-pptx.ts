/** Action-point PowerPoint export (pptxgenjs, loaded on demand). Split out of lib/export/pptx.ts to keep it under the file-size ratchet. */
import {
  ACOB_DARK,
  ACOB_GREEN,
  ACOB_OFFWHITE,
  ACOB_SLATE,
  ACOB_WHITE,
  ActionItem,
  EXPORT_LOGOS,
  PptxConstructor,
  WeeklyPptxTheme,
  buildActionPointFilename,
  groupActionItemsByDepartment,
  inFlightActionPointFileExports,
  loadPptxGenJS,
  logoBoxByHeight,
} from "./shared"
import { addCoverSlide, addDeptIndexSlide, getWeeklyPptxThemeColors } from "./pptx"

export const exportActionPointToPPTX = async (
  actions: ActionItem[],
  week: number,
  year: number,
  meetingDate?: string,
  department?: string
): Promise<void> => {
  const exportKey = ["pptx", week, year, meetingDate || "", department || "all", actions.length].join(":")
  if (inFlightActionPointFileExports.has(exportKey)) return
  inFlightActionPointFileExports.add(exportKey)

  try {
    const PptxConstructor = await loadPptxGenJS()
    const pres = new PptxConstructor()
    pres.layout = "LAYOUT_WIDE"

    // Cover slide
    addCoverSlide(pres, week, year, "Action Points")

    // Group by department
    const { grouped, departments } = groupActionItemsByDepartment(actions)

    // TOC slide
    addDeptIndexSlide(pres, departments, week, year)

    departments.forEach((dept, idx) => {
      const deptActions = grouped[dept] || []
      const slide = pres.addSlide()
      slide.background = { color: ACOB_OFFWHITE }

      // Header
      slide.addShape(pres.ShapeType?.rect ?? "rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.65,
        fill: { color: ACOB_DARK },
        line: { color: ACOB_DARK },
      })
      slide.addText(dept.toUpperCase(), {
        x: 0.3,
        y: 0,
        w: 9,
        h: 0.65,
        fontSize: 14,
        bold: true,
        color: ACOB_WHITE,
        valign: "middle",
        fontFace: "Calibri",
      })
      try {
        const markBox = logoBoxByHeight(EXPORT_LOGOS.matrixMarkInverse, 0.4)
        slide.addImage({
          path: EXPORT_LOGOS.matrixMarkInverse.path,
          x: 13.33 - 0.3 - markBox.w,
          y: (0.65 - markBox.h) / 2,
          ...markBox,
        })
      } catch {
        /* skip */
      }

      // Week badge
      slide.addText(`Week ${week}, ${year}`, {
        x: 9.5,
        y: 0.7,
        w: 3.5,
        h: 0.35,
        fontSize: 10,
        bold: true,
        color: ACOB_WHITE,
        fill: { color: ACOB_GREEN },
        align: "center",
        valign: "middle",
        fontFace: "Calibri",
      })

      // Table header: S/N | ACTION ITEM | STATUS
      const tableY = 1.2
      const colWidths = [0.8, 9.2, 2.8]
      const headers = ["S/N", "ACTION ITEM", "STATUS"]
      const colX = [0.25, 1.05, 10.25]

      slide.addShape(pres.ShapeType?.rect ?? "rect", {
        x: 0.25,
        y: tableY,
        w: 12.83,
        h: 0.38,
        fill: { color: ACOB_GREEN },
        line: { color: ACOB_GREEN },
      })
      headers.forEach((h, i) => {
        slide.addText(h, {
          x: colX[i] + 0.1,
          y: tableY,
          w: colWidths[i] - 0.1,
          h: 0.38,
          fontSize: 9,
          bold: true,
          color: ACOB_WHITE,
          valign: "middle",
          fontFace: "Calibri",
        })
      })

      const statusColors: Record<string, string> = {
        completed: "166534",
        in_progress: "1D4ED8",
        not_started: "C2410C",
        pending: "64748B",
      }
      const statusLabels: Record<string, string> = {
        completed: "Completed",
        in_progress: "In Progress",
        not_started: "Not Started",
        pending: "Pending",
      }

      let rowY = tableY + 0.38
      const rowH = 0.38
      deptActions.slice(0, 14).forEach((action, i) => {
        const bg = i % 2 === 0 ? "F8FAFB" : ACOB_WHITE
        slide.addShape(pres.ShapeType?.rect ?? "rect", {
          x: 0.25,
          y: rowY,
          w: 12.83,
          h: rowH,
          fill: { color: bg },
          line: { color: "E2E8F0", width: 0.5 },
        })
        // S/N
        slide.addText(`${i + 1}`, {
          x: colX[0] + 0.1,
          y: rowY,
          w: colWidths[0] - 0.1,
          h: rowH,
          fontSize: 10,
          bold: true,
          color: ACOB_SLATE,
          valign: "middle",
          fontFace: "Calibri",
        })
        // Action item — full width, no truncation
        slide.addText(action.title, {
          x: colX[1] + 0.1,
          y: rowY,
          w: colWidths[1] - 0.1,
          h: rowH,
          fontSize: 10,
          color: ACOB_SLATE,
          valign: "middle",
          fontFace: "Calibri",
        })
        const sc = statusColors[action.status] || statusColors.pending
        const sl = statusLabels[action.status] || action.status
        slide.addText(sl, {
          x: colX[2] + 0.1,
          y: rowY + 0.05,
          w: colWidths[2] - 0.2,
          h: rowH - 0.1,
          fontSize: 9,
          bold: true,
          color: ACOB_WHITE,
          fill: { color: sc },
          align: "center",
          valign: "middle",
          fontFace: "Calibri",
        })
        rowY += rowH
      })

      // Footer
      slide.addShape(pres.ShapeType?.rect ?? "rect", {
        x: 0,
        y: 6.9,
        w: "100%",
        h: 0.6,
        fill: { color: ACOB_GREEN },
        line: { color: ACOB_GREEN },
      })
      const nextDept = departments[idx + 1]
      if (nextDept) {
        slide.addText(`NEXT: ${nextDept}`, {
          x: 7,
          y: 6.9,
          w: 6.1,
          h: 0.6,
          fontSize: 10,
          color: ACOB_WHITE,
          align: "right",
          valign: "middle",
          fontFace: "Calibri",
          bold: true,
        })
      }
      slide.addText(String(idx + 3), {
        x: 0,
        y: 6.9,
        w: "100%",
        h: 0.6,
        fontSize: 10,
        color: ACOB_WHITE,
        align: "center",
        valign: "middle",
        fontFace: "Calibri",
        bold: true,
      })
    })

    await pres.writeFile({
      fileName: buildActionPointFilename({ week, year, meetingDate, extension: "pptx", department }),
    })
  } finally {
    inFlightActionPointFileExports.delete(exportKey)
  }
}
