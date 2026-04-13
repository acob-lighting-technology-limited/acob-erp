"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Brain, Plus, Trash2 } from "lucide-react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ReviewCycle = {
  id: string
  name: string
  review_type: string | null
}

type CbtQuestion = {
  id: string
  review_cycle_id?: string | null
  prompt: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: "A" | "B" | "C" | "D"
  explanation?: string | null
}

const INITIAL_FORM = {
  prompt: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A" as "A" | "B" | "C" | "D",
  explanation: "",
}

export default function AdminPmsCbtCyclePage() {
  const params = useParams<{ cycleId: string }>()
  const cycleId = String(params.cycleId || "")
  const [cycle, setCycle] = useState<ReviewCycle | null>(null)
  const [questions, setQuestions] = useState<CbtQuestion[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  const loadPage = useCallback(async () => {
    try {
      const [cyclesResponse, questionsResponse] = await Promise.all([
        fetch("/api/hr/performance/cbt", { cache: "no-store" }),
        fetch(`/api/hr/performance/cbt/questions?cycle_id=${encodeURIComponent(cycleId)}`, { cache: "no-store" }),
      ])
      const cyclesPayload = (await cyclesResponse.json().catch(() => null)) as {
        data?: { cycles?: ReviewCycle[] }
      } | null
      const questionsPayload = (await questionsResponse.json().catch(() => null)) as { data?: CbtQuestion[] } | null
      setCycle(cyclesPayload?.data?.cycles?.find((entry) => entry.id === cycleId) || null)
      setQuestions(questionsPayload?.data || [])
    } catch {
      toast.error("Failed to load CBT cycle")
    }
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    void loadPage()
  }, [cycleId, loadPage])

  const cycleName = useMemo(() => cycle?.name || "CBT Cycle", [cycle?.name])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch("/api/hr/performance/cbt/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, review_cycle_id: cycleId }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to save question")
      toast.success("CBT question saved")
      setForm(INITIAL_FORM)
      setIsModalOpen(false)
      await loadPage()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save question")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(questionId: string) {
    setDeletingId(questionId)
    try {
      const response = await fetch(`/api/hr/performance/cbt/questions/${questionId}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to delete question")
      toast.success("Question deleted")
      await loadPage()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete question")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={cycleName}
        description="Manage the question bank for this CBT cycle."
        icon={Brain}
        backLink={{ href: "/admin/hr/pms/cbt", label: "Back to PMS CBT" }}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/cbt">
              <Button size="sm">Start Test</Button>
            </Link>
            <Button size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Link
          href="/admin/hr/pms/cbt"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to cycle table
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Bank</CardTitle>
          <CardDescription>{questions.length} question(s) in this cycle.</CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No CBT questions have been added for this cycle yet.</p>
          ) : (
            <Table className="min-w-[1100px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Option A</TableHead>
                  <TableHead>Option B</TableHead>
                  <TableHead>Option C</TableHead>
                  <TableHead>Option D</TableHead>
                  <TableHead>Correct</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question, index) => (
                  <TableRow key={question.id}>
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{question.prompt}</TableCell>
                    <TableCell>{question.option_a}</TableCell>
                    <TableCell>{question.option_b}</TableCell>
                    <TableCell>{question.option_c}</TableCell>
                    <TableCell>{question.option_d}</TableCell>
                    <TableCell>{question.correct_option}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(question.id)}
                        disabled={deletingId === question.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Question</DialogTitle>
            <DialogDescription>Add objective questions for {cycleName}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                rows={4}
                value={form.prompt}
                onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Option A</Label>
                <Input
                  value={form.option_a}
                  onChange={(event) => setForm((current) => ({ ...current, option_a: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Option B</Label>
                <Input
                  value={form.option_b}
                  onChange={(event) => setForm((current) => ({ ...current, option_b: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Option C</Label>
                <Input
                  value={form.option_c}
                  onChange={(event) => setForm((current) => ({ ...current, option_c: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Option D</Label>
                <Input
                  value={form.option_d}
                  onChange={(event) => setForm((current) => ({ ...current, option_d: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select
                  value={form.correct_option}
                  onValueChange={(value: "A" | "B" | "C" | "D") =>
                    setForm((current) => ({ ...current, correct_option: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Option A</SelectItem>
                    <SelectItem value="B">Option B</SelectItem>
                    <SelectItem value="C">Option C</SelectItem>
                    <SelectItem value="D">Option D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Explanation</Label>
                <Input
                  value={form.explanation}
                  onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save Question
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
