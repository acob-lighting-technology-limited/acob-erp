"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import type { CreateOpportunityInput, CRMContact, CRMPipeline } from "@/types/crm"

interface NewOpportunityContentProps {
  initialContacts: CRMContact[]
  initialPipeline: CRMPipeline | null
  preselectedContactId: string | null
}

export function NewOpportunityContent({
  initialContacts,
  initialPipeline,
  preselectedContactId: propContactId,
}: NewOpportunityContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedContactId = propContactId || searchParams.get("contact_id")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contacts, setContacts] = useState<CRMContact[]>(initialContacts)
  const [pipelines, setPipelines] = useState<CRMPipeline[]>(initialPipeline ? [initialPipeline] : [])
  const [selectedPipeline, setSelectedPipeline] = useState<CRMPipeline | null>(initialPipeline)
  const [users, setUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  const [formData, setFormData] = useState<CreateOpportunityInput>({
    name: "",
    contact_id: preselectedContactId || "",
    description: "",
    value: 0,
    currency: "NGN",
    probability: initialPipeline?.stages?.[0]?.probability || 50,
    stage: initialPipeline?.stages?.[0]?.name || "New",
    pipeline_id: initialPipeline?.id || "",
    expected_close: "",
    notes: "",
  })

  // Contacts and pipeline provided via props, load users
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const usersRes = await fetch("/api/admin/users")
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Opportunity name is required")
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success("Opportunity created")
      router.push(`/admin/crm/opportunities/${data.data.id}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to create opportunity")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePipelineChange = (pipelineId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId)
    if (pipeline) {
      setSelectedPipeline(pipeline)
      setFormData((prev) => ({
        ...prev,
        pipeline_id: pipelineId,
        stage: pipeline.stages[0]?.name || "New",
        probability: pipeline.stages[0]?.probability || 10,
      }))
    }
  }

  const handleStageChange = (stageName: string) => {
    const stage = selectedPipeline?.stages.find((s) => s.name === stageName)
    setFormData((prev) => ({
      ...prev,
      stage: stageName,
      probability: stage?.probability || prev.probability,
    }))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/crm/opportunities">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Opportunity</h1>
          <p className="text-muted-foreground">Create a new sales opportunity</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Opportunity Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Opportunity Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Website Development Project"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_id">Contact</Label>
                <Select
                  value={formData.contact_id || ""}
                  onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.contact_name} {contact.company_name && `(${contact.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this opportunity..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle>Value & Timeline</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="value">Deal Value (NGN)</Label>
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.value || ""}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_close">Expected Close Date</Label>
                  <Input
                    id="expected_close"
                    type="date"
                    value={formData.expected_close || ""}
                    onChange={(e) => setFormData({ ...formData, expected_close: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="probability">Probability (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability || ""}
                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Weighted Value</Label>
                  <div className="bg-muted text-muted-foreground flex h-10 items-center rounded-md px-3">
                    ₦{(((formData.value || 0) * (formData.probability || 0)) / 100).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline & Stage</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pipeline">Pipeline</Label>
                  <Select value={formData.pipeline_id || ""} onValueChange={handlePipelineChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name} {pipeline.is_default && "(Default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage">Stage</Label>
                  <Select value={formData.stage || ""} onValueChange={handleStageChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedPipeline?.stages.map((stage) => (
                        <SelectItem key={stage.name} value={stage.name}>
                          {stage.name} ({stage.probability}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select
                  value={formData.assigned_to || ""}
                  onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner (defaults to you)" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this opportunity..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/admin/crm/opportunities">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Opportunity
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
