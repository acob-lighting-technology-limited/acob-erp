import test from "node:test"
import assert from "node:assert/strict"
import { columnsToSheetFields, deriveSheetActions, isLongField, splitSheetActions } from "../detail-sheet-model"
import type { DataTableColumn, RowAction } from "../types"

type Row = { id: string; name: string; status: string; amount: number | null }
const row: Row = { id: "1", name: "Ada", status: "approved", amount: 5000 }

test("a column with an accessor contributes its plain value, blanks and placeholders are dropped", () => {
  const columns: DataTableColumn<Row>[] = [
    { key: "name", label: "Name", accessor: (r) => r.name },
    { key: "dash", label: "Dash", accessor: () => "-" },
    { key: "emdash", label: "Em dash", accessor: () => "—" },
    { key: "empty", label: "Empty", accessor: () => "" },
    { key: "nil", label: "Nil", accessor: () => null },
    { key: "amount", label: "Amount", accessor: (r) => r.amount },
  ]
  const fields = columnsToSheetFields(columns, row)
  assert.deepEqual(
    fields.map((f) => [f.label, f.value]),
    [
      ["Name", "Ada"],
      ["Amount", "5000"],
    ]
  )
})

test("a render-only column is no longer lost: its rendered cell is shown", () => {
  const columns: DataTableColumn<Row>[] = [
    { key: "name", label: "Name", accessor: (r) => r.name },
    { key: "status", label: "Status", render: (r) => `badge:${r.status}` },
  ]
  const fields = columnsToSheetFields(columns, row)
  assert.equal(fields.length, 2)
  assert.equal(fields[1].label, "Status")
  assert.equal(fields[1].node, "badge:approved")
  assert.equal(fields[1].value, null)
})

test("render-only columns that render nothing are skipped", () => {
  const columns: DataTableColumn<Row>[] = [
    { key: "a", label: "A", render: () => null },
    { key: "b", label: "B", render: () => false },
    { key: "c", label: "C", render: () => "" },
  ]
  assert.deepEqual(columnsToSheetFields(columns, row), [])
})

test("mechanical columns, unlabelled columns and sheet:false are never shown", () => {
  const columns: DataTableColumn<Row>[] = [
    { key: "actions", label: "Actions", render: () => "buttons" },
    { key: "action", label: "Action", render: () => "button" },
    { key: "select", label: "Select", render: () => "x" },
    { key: "sn", label: "S/N", render: () => "1" },
    { key: "blank", label: "", render: () => "x" },
    { key: "hidden", label: "Hidden", accessor: () => "secret", sheet: false },
    { key: "ok", label: "Fine", accessor: () => "yes" },
  ]
  assert.deepEqual(
    columnsToSheetFields(columns, row).map((f) => f.label),
    ["Fine"]
  )
})

test("hideOnMobile columns are still shown: the sheet is where wide data belongs", () => {
  const columns: DataTableColumn<Row>[] = [{ key: "name", label: "Name", accessor: (r) => r.name, hideOnMobile: true }]
  assert.equal(columnsToSheetFields(columns, row).length, 1)
})

const calls: string[] = []
const rowActions: RowAction<Row>[] = [
  { label: "Edit", onClick: (r) => calls.push(`edit:${r.id}`) },
  { label: "Delete", variant: "destructive", onClick: (r) => calls.push(`delete:${r.id}`) },
  { label: "Approve", onClick: (r) => calls.push(`approve:${r.id}`), hidden: (r) => r.status === "approved" },
  { label: "Export", onClick: (r) => calls.push(`export:${r.id}`) },
]

test("sheet actions come from rowActions: hidden dropped, destructive last, first is primary", () => {
  const actions = deriveSheetActions(rowActions, row)
  assert.deepEqual(
    actions.map((a) => [a.label, a.variant]),
    [
      ["Edit", "default"],
      ["Export", "outline"],
      ["Delete", "destructive"],
    ]
  )
})

test("a hidden action returns for a row it applies to", () => {
  const pending = { ...row, status: "pending" }
  assert.ok(deriveSheetActions(rowActions, pending).some((a) => a.label === "Approve"))
})

test("actions call the row action with this row", () => {
  calls.length = 0
  const [edit, , del] = deriveSheetActions(rowActions, row)
  edit.onClick?.()
  del.onClick?.()
  assert.deepEqual(calls, ["edit:1", "delete:1"])
})

test("onSelect becomes a leading Open action", () => {
  let opened = ""
  const actions = deriveSheetActions(rowActions, row, { onSelect: (r) => (opened = r.id) })
  assert.deepEqual(
    actions.map((a) => a.label),
    ["Open", "Edit", "Export", "Delete"]
  )
  assert.equal(actions[0].variant, "default")
  assert.equal(actions[1].variant, "outline")
  actions[0].onClick?.()
  assert.equal(opened, "1")
})

test("no rowActions and no onSelect gives no actions", () => {
  assert.deepEqual(deriveSheetActions(undefined, row), [])
  assert.deepEqual(deriveSheetActions([], row), [])
})

test("a lone destructive action is still styled destructive, not primary", () => {
  const actions = deriveSheetActions([{ label: "Remove", variant: "destructive", onClick: () => undefined }], row)
  assert.equal(actions[0].variant, "destructive")
})

test("splitSheetActions keeps three as buttons and folds the rest behind More", () => {
  assert.deepEqual(splitSheetActions([1, 2, 3]), { visible: [1, 2, 3], overflow: [] })
  assert.deepEqual(splitSheetActions([1, 2, 3, 4, 5]), { visible: [1, 2], overflow: [3, 4, 5] })
  assert.deepEqual(splitSheetActions([1, 2, 3, 4], 2), { visible: [1], overflow: [2, 3, 4] })
  assert.deepEqual(splitSheetActions([]), { visible: [], overflow: [] })
})

test("isLongField stacks long text, multi-line text, links and explicit widths", () => {
  assert.equal(isLongField({ value: "short" }), false)
  assert.equal(isLongField({ value: "x".repeat(36) }), true)
  assert.equal(isLongField({ value: "a\nb" }), true)
  assert.equal(isLongField({ value: "x", fullWidth: true }), true)
  assert.equal(isLongField({ value: "x", colSpan: 2 }), true)
  assert.equal(isLongField({ value: "x", colSpan: 1 }), false)
  assert.equal(isLongField({ value: "x", href: "https://a" }), true)
  assert.equal(isLongField({ value: null }), false)
})
