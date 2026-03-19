"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, Edit2, Eye } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { formatName } from "@/lib/utils"

type SortKey = "last_name" | "first_name" | "company_email" | "department" | null

interface AdminUserTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any[]
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (key: SortKey) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onViewDetails: (user: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditUser: (user: any) => void
}

function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-"
  return phone.toString().replace(/[^0-9+]/g, "") || "-"
}

function properCase(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .toString()
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

export function AdminUserTable({ users, sortKey, sortDir, onSort, onViewDetails, onEditUser }: AdminUserTableProps) {
  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    return (
      <button onClick={() => onSort(field)} className="underline-offset-2 hover:underline">
        {label} {sortKey === field ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Members</CardTitle>
        <CardDescription>Total: {users.length} users</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/N</TableHead>
                <TableHead>
                  <SortHeader label="Last Name" field="last_name" />
                </TableHead>
                <TableHead>
                  <SortHeader label="First Name" field="first_name" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Email" field="company_email" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Department" field="department" />
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={user.id} className="cursor-pointer" onClick={() => onViewDetails(user)}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{formatName(user.last_name)}</TableCell>
                  <TableCell>{formatName(user.first_name)}</TableCell>
                  <TableCell>
                    <button
                      className="underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText((user.company_email || "").toLowerCase())
                        toast.success("Email copied")
                      }}
                    >
                      {(user.company_email || "").toLowerCase()}
                    </button>
                  </TableCell>
                  <TableCell>{user.department ? properCase(user.department) : "-"}</TableCell>
                  <TableCell>{cleanPhoneNumber(user.phone_number)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => onEditUser(user)} aria-label="Edit user">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${formatName(user.first_name)} ${formatName(user.last_name)} - ${(user.company_email || "").toLowerCase()}`
                          )
                          toast.success("User details copied")
                        }}
                        aria-label="Copy user details"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Link href={`/tools/signature?userId=${user.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" aria-label="View signature">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
