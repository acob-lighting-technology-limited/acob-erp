import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"
import { Pencil, Trash2, Shield, Users } from "lucide-react"
import type { Role } from "./role-form-dialog"

interface RolesTableProps {
  roles: Role[]
  loading: boolean
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  onViewUsers: (roleName: string) => void
}

export function RolesTable({ roles, loading, onEdit, onDelete, onViewUsers }: RolesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Roles</CardTitle>
        <CardDescription>{roles.length} roles defined</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : roles.length === 0 ? (
          <EmptyState title="No roles defined" icon={Shield} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">S/N</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role, index) => (
                <TableRow key={role.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium capitalize">{role.name.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{role.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.permissions?.length || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => onViewUsers(role.name)}
                    >
                      <Users className="text-muted-foreground h-4 w-4" />
                      {role.user_count || 0}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.is_system ? "destructive" : "secondary"}>
                      {role.is_system ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(role)} disabled={role.is_system}>
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
