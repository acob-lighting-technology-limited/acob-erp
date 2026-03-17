"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CorrespondenceRecord } from "@/types/correspondence"

interface CorrespondenceTableProps {
  records: CorrespondenceRecord[]
  incomingOptions: CorrespondenceRecord[]
  linkReference: Record<string, string>
  onLinkReferenceChange: (recordId: string, value: string) => void
  dispatchingId: string | null
  linkingId: string | null
  onUpdateStatus: (recordId: string, status: string) => void
  onDispatch: (recordId: string) => void
  onLinkResponse: (recordId: string) => void
}

export function CorrespondenceTable({
  records,
  incomingOptions,
  linkReference,
  onLinkReferenceChange,
  dispatchingId,
  linkingId,
  onUpdateStatus,
  onDispatch,
  onLinkResponse,
}: CorrespondenceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My References</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.reference_number}</TableCell>
                <TableCell>
                  <Badge variant="outline">{record.direction}</Badge>
                </TableCell>
                <TableCell>{record.department_name || record.assigned_department_name || "-"}</TableCell>
                <TableCell>
                  <Badge>{record.status}</Badge>
                </TableCell>
                <TableCell>{record.subject}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    {record.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => onUpdateStatus(record.id, "under_review")}>
                        Send for Review
                      </Button>
                    )}
                    {record.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDispatch(record.id)}
                        disabled={dispatchingId === record.id}
                      >
                        {dispatchingId === record.id ? "Dispatching..." : "Dispatch"}
                      </Button>
                    )}
                    {record.direction === "outgoing" && (
                      <>
                        <Select
                          value={linkReference[record.id] || ""}
                          onValueChange={(value) => onLinkReferenceChange(record.id, value)}
                        >
                          <SelectTrigger className="w-[210px]">
                            <SelectValue placeholder="Link incoming reference" />
                          </SelectTrigger>
                          <SelectContent>
                            {incomingOptions.map((incoming) => (
                              <SelectItem key={incoming.id} value={incoming.id}>
                                {incoming.reference_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onLinkResponse(record.id)}
                          disabled={linkingId === record.id}
                        >
                          {linkingId === record.id ? "Linking..." : "Link"}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
