"use client"

/* eslint-disable @next/next/no-img-element -- the signature preview is a short-lived signed URL */
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, CircleAlert, KeyRound, Loader2, PenLine, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api-client"
import { PinInput } from "./pin-input"
import { SignaturePad } from "./signature-pad"

export interface SigningStatus {
  has_signature: boolean
  has_pin: boolean
  signature_url: string | null
  signature_updated_at: string | null
  pin_set_at: string | null
  pin_locked_until: string | null
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null)
  return (json && (json.error as string)) || fallback
}

function StatusLine({ done, text }: { done: boolean; text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden />
      )}
      {text}
    </p>
  )
}

const ALLOWED_SIGNATURE_TYPES = ["image/png", "image/jpeg", "image/webp"]

export function SignatureSection({ status, onSaved }: { status: SigningStatus; onSaved: (s: SigningStatus) => void }) {
  const [drawn, setDrawn] = useState<Blob | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState("draw")
  const [saving, setSaving] = useState(false)
  const handleDrawn = useCallback((blob: Blob | null) => setDrawn(blob), [])

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = (f: File | null) => {
    if (!f) return
    if (!ALLOWED_SIGNATURE_TYPES.includes(f.type)) {
      toast.error("Please choose a PNG, JPG, or WebP image")
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB")
      return
    }
    setFile(f)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFile(droppedFile)
    }
  }

  const save = async () => {
    const blob = mode === "draw" ? drawn : file
    if (!blob) {
      toast.error(mode === "draw" ? "Draw your signature first" : "Choose an image first")
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.append("file", blob, mode === "draw" ? "signature.png" : (file?.name ?? "signature"))
      const res = await apiFetch("/api/profile/signing/signature", { method: "POST", body: form })
      if (!res.ok) throw new Error(await readError(res, "Could not save your signature"))
      onSaved((await res.json()).data)
      toast.success("Signature saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your signature")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Signature</CardTitle>
            <CardDescription className="text-sm">
              Printed on the forms you sign. Each form keeps the signature you had when you signed it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusLine
          done={status.has_signature}
          text={status.has_signature ? "Signature on file" : "No signature yet"}
        />
        {status.signature_url ? (
          <div className="inline-block rounded-md border bg-white p-3">
            <img src={status.signature_url} alt="Your current signature" className="h-14 w-auto" />
          </div>
        ) : null}
        <Tabs value={mode} onValueChange={setMode} className="max-w-xl">
          <TabsList>
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="draw" className="pt-2">
            <SignaturePad onChange={handleDrawn} />
          </TabsContent>
          <TabsContent value="upload" className="space-y-3 pt-2">
            <Label htmlFor="signature-file" className="text-sm font-medium">
              Image of your signature (PNG, JPG or WebP)
            </Label>

            {file && filePreview ? (
              <div className="border-primary/40 bg-muted/20 relative rounded-lg border-2 border-dashed p-4">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="rounded-md border bg-white p-3 shadow-xs">
                    <img src={filePreview} alt="Signature preview" className="max-h-24 max-w-full object-contain" />
                  </div>
                  <div className="text-center">
                    <p className="text-foreground text-xs font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-[11px]">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Choose another
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 text-xs"
                      onClick={() => setFile(null)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <div className="bg-background mb-2 flex h-10 w-10 items-center justify-center rounded-full border shadow-xs">
                  <Upload className={`h-5 w-5 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <p className="text-foreground text-sm font-medium">
                  <span className="text-primary font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">PNG, JPG or WebP (max 5 MB)</p>
                <p className="text-muted-foreground/80 mt-2 text-[11px]">Dark ink on white background works best.</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              id="signature-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null)
                e.target.value = ""
              }}
            />
          </TabsContent>
        </Tabs>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {status.has_signature ? "Replace signature" : "Save signature"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function PinSection({ status, onSaved }: { status: SigningStatus; onSaved: (s: SigningStatus) => void }) {
  const [currentPin, setCurrentPin] = useState("")
  const [pin, setPin] = useState("")
  const [confirm, setConfirm] = useState("")
  const [code, setCode] = useState("")
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const clear = () => {
    setCurrentPin("")
    setPin("")
    setConfirm("")
    setCode("")
  }

  const submit = async () => {
    if (pin.length !== 6) return toast.error("Your PIN must be 6 digits")
    if (pin !== confirm) return toast.error("The two PINs do not match")
    setBusy(true)
    try {
      const res = resetSentTo
        ? await apiFetch("/api/profile/signing/pin-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm", code, pin }),
          })
        : await apiFetch("/api/profile/signing/pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(status.has_pin ? { pin, current_pin: currentPin } : { pin }),
          })
      if (!res.ok) throw new Error(await readError(res, "Could not save your PIN"))
      onSaved((await res.json()).data)
      toast.success(status.has_pin ? "PIN changed" : "PIN created")
      setResetSentTo(null)
      clear()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your PIN")
    } finally {
      setBusy(false)
    }
  }

  const requestReset = async () => {
    setBusy(true)
    try {
      const res = await apiFetch("/api/profile/signing/pin-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      })
      if (!res.ok) throw new Error(await readError(res, "Could not send a reset code"))
      const sentTo = (await res.json()).data.sent_to as string
      setResetSentTo(sentTo)
      clear()
      toast.success(`Code sent to ${sentTo}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a reset code")
    } finally {
      setBusy(false)
    }
  }

  const locked = status.pin_locked_until
    ? new Date(status.pin_locked_until).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    : null

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Approval PIN</CardTitle>
            <CardDescription className="text-sm">
              Six digits you enter every time you sign, reject or record a payment. Nobody else can see or set it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusLine done={status.has_pin} text={status.has_pin ? "PIN set" : "No PIN yet"} />
        {locked ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Too many wrong PINs. Signing is locked until {locked}. You can reset it below.
          </p>
        ) : null}

        <div className="grid max-w-md gap-4">
          {resetSentTo ? (
            <div className="space-y-2">
              <Label htmlFor="reset-code">Code sent to {resetSentTo}</Label>
              <PinInput id="reset-code" value={code} onChange={setCode} aria-label="Reset code" />
            </div>
          ) : status.has_pin ? (
            <div className="space-y-2">
              <Label htmlFor="current-pin">Current PIN</Label>
              <PinInput id="current-pin" value={currentPin} onChange={setCurrentPin} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="new-pin">{status.has_pin ? "New PIN" : "PIN"}</Label>
            <PinInput id="new-pin" value={pin} onChange={setPin} />
            <p className="text-muted-foreground text-xs">Avoid 123456 or one repeated digit.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirm PIN</Label>
            <PinInput id="confirm-pin" value={confirm} onChange={setConfirm} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {resetSentTo ? "Set new PIN" : status.has_pin ? "Change PIN" : "Create PIN"}
          </Button>
          {status.has_pin && !resetSentTo ? (
            <Button variant="ghost" onClick={requestReset} disabled={busy}>
              Forgot PIN? Email me a code
            </Button>
          ) : null}
          {resetSentTo ? (
            <Button variant="ghost" onClick={() => setResetSentTo(null)} disabled={busy}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/** Settings → Signing: what every signer and payment processor sets up once. */
export function SigningSetup() {
  const [status, setStatus] = useState<SigningStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiFetch("/api/profile/signing")
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "Could not load your signing setup"))
        return res.json()
      })
      .then((json) => active && setStatus(json.data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])

  if (error) return <p className="text-destructive text-sm">{error}</p>
  if (!status) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SignatureSection status={status} onSaved={setStatus} />
      <PinSection status={status} onSaved={setStatus} />
    </div>
  )
}
