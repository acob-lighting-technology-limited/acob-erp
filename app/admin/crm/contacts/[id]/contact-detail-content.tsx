"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Globe,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Target,
  Plus,
  User,
  Activity,
  MoreHorizontal,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react"
import Link from "next/link"
import type { CRMContact, CRMOpportunity, CRMActivity } from "@/types/crm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const typeColors: Record<string, string> = {
  lead: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  customer: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  vendor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  partner: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
}

const activityIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: Activity,
  task: CheckCircle,
  follow_up: Clock,
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

type ContactWithRelations = CRMContact & { opportunities?: CRMOpportunity[]; activities?: CRMActivity[] }

interface ContactDetailContentProps {
  initialContact: ContactWithRelations
}

export function ContactDetailContent({ initialContact }: ContactDetailContentProps) {
  const router = useRouter()
  const params = useParams()
  const contactId = params.id as string

  const [contact, setContact] = useState<ContactWithRelations | null>(initialContact)
  const [isLoading, setIsLoading] = useState(false)

  // loadContact for client-side refresh after actions
  const loadContact = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/crm/contacts/${contactId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setContact(data.data)
    } catch (error: any) {
      console.error("Error loading contact:", error)
      toast.error("Failed to load contact")
      router.push("/admin/crm/contacts")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this contact? This action cannot be undone.")) return

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      toast.success("Contact deleted")
      router.push("/admin/crm/contacts")
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contact")
    }
  }

  const handleConvertToCustomer = async () => {
    if (!confirm("Convert this lead to a customer?")) return

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convert_to_customer: true }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      toast.success("Contact converted to customer!")
      loadContact()
    } catch (error: any) {
      toast.error(error.message || "Failed to convert contact")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="p-6 text-center">
        <p>Contact not found</p>
        <Button asChild className="mt-4">
          <Link href="/admin/crm/contacts">Back to Contacts</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/crm/contacts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-full">
            <User className="text-primary h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contact.contact_name}</h1>
              <Badge variant="secondary" className={typeColors[contact.type]}>
                {contact.type}
              </Badge>
            </div>
            {contact.company_name && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {contact.company_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {contact.type === "lead" && (
            <Button variant="outline" onClick={handleConvertToCustomer}>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Convert to Customer
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/admin/crm/contacts/${contactId}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities ({contact.opportunities?.length || 0})</TabsTrigger>
              <TabsTrigger value="activities">Activities ({contact.activities?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {contact.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="text-muted-foreground h-4 w-4" />
                      <a href={`tel:${contact.phone}`} className="hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.mobile && (
                    <div className="flex items-center gap-3">
                      <Phone className="text-muted-foreground h-4 w-4" />
                      <span>{contact.mobile} (Mobile)</span>
                    </div>
                  )}
                  {contact.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="text-muted-foreground h-4 w-4" />
                      <a
                        href={contact.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {contact.website}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Address */}
              {contact.address && Object.values(contact.address).some((v) => v) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <MapPin className="text-muted-foreground mt-1 h-4 w-4" />
                      <div>
                        {contact.address.street && <p>{contact.address.street}</p>}
                        <p>
                          {[contact.address.city, contact.address.state, contact.address.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {contact.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="opportunities" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Opportunities</CardTitle>
                  <Link
                    href={`/admin/crm/opportunities/new?contact_id=${contactId}`}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Opportunity
                  </Link>
                </CardHeader>
                <CardContent>
                  {contact.opportunities && contact.opportunities.length > 0 ? (
                    <div className="space-y-3">
                      {contact.opportunities.map((opp) => (
                        <Link
                          key={opp.id}
                          href={`/admin/crm/opportunities/${opp.id}`}
                          className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{opp.name}</p>
                            <p className="text-muted-foreground text-sm">
                              Stage: {opp.stage} • {opp.probability}% probability
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(opp.value)}</p>
                            <Badge
                              variant={
                                opp.status === "won" ? "default" : opp.status === "lost" ? "destructive" : "secondary"
                              }
                            >
                              {opp.status}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground py-8 text-center">
                      <Target className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p>No opportunities yet</p>
                      <Link
                        href={`/admin/crm/opportunities/new?contact_id=${contactId}`}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium"
                      >
                        Create First Opportunity
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activities" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Activities</CardTitle>
                  <Link
                    href={`/admin/crm/activities/new?contact_id=${contactId}`}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Log Activity
                  </Link>
                </CardHeader>
                <CardContent>
                  {contact.activities && contact.activities.length > 0 ? (
                    <div className="space-y-3">
                      {contact.activities.map((activity) => {
                        const Icon = activityIcons[activity.type] || Activity
                        return (
                          <div key={activity.id} className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                activity.completed ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{activity.subject}</p>
                              {activity.description && (
                                <p className="text-muted-foreground line-clamp-2 text-sm">{activity.description}</p>
                              )}
                              <p className="text-muted-foreground mt-1 text-xs">
                                {new Date(activity.created_at).toLocaleDateString()} • {activity.type}
                                {activity.completed && " ✓ Completed"}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground py-8 text-center">
                      <Activity className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p>No activities logged</p>
                      <Button className="mt-4" size="sm" asChild>
                        <Link href={`/admin/crm/activities/new?contact_id=${contactId}`}>Log First Activity</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm">Stage</p>
                <Badge variant="outline">{contact.stage}</Badge>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm">Score</p>
                <p className="font-semibold">{contact.score}/100</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm">Source</p>
                <p className="font-medium">{contact.source || "—"}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm">Industry</p>
                <p className="font-medium">{contact.industry || "—"}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm">Assigned To</p>
                <p className="font-medium">
                  {contact.assigned_user
                    ? `${contact.assigned_user.first_name} ${contact.assigned_user.last_name}`
                    : "Unassigned"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up */}
          {contact.next_follow_up && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Next Follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <p className="font-medium">{new Date(contact.next_follow_up).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(contact.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(contact.updated_at).toLocaleDateString()}</span>
              </div>
              {contact.last_contact_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Contact</span>
                  <span>{new Date(contact.last_contact_date).toLocaleDateString()}</span>
                </div>
              )}
              {contact.converted_to_customer_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Converted</span>
                  <span>{new Date(contact.converted_to_customer_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
