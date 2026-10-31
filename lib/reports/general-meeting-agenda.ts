/**
 * The standing Monday general-meeting agenda. The reminder email's default
 * agenda and the agenda deck export are both built from this list, so the two
 * always show the same items in the same order.
 */
export const GENERAL_MEETING_AGENDA = [
  { key: "prayer", title: "Opening Prayer" },
  { key: "kss", title: "Knowledge Sharing Session", detail: "30 minutes" },
  { key: "minutes", title: "Minutes of the Last Meeting" },
  { key: "departments", title: "Departmental Updates" },
  { key: "aob", title: "Any Other Business" },
  { key: "md", title: "MD's Remarks" },
  { key: "closing", title: "Closing Remarks" },
] as const satisfies readonly { key: string; title: string; detail?: string }[]

export type GeneralMeetingAgendaKey = (typeof GENERAL_MEETING_AGENDA)[number]["key"]

/** One line per item, as the reminder email lists them. */
export const GENERAL_MEETING_AGENDA_LINES: string[] = GENERAL_MEETING_AGENDA.map((item) =>
  "detail" in item ? `${item.title} (${item.detail})` : item.title
)
