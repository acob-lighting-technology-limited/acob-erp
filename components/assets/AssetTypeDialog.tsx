"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus } from "lucide-react"

const assetTypeSchema = z.object({
  label: z.string().min(1, "Full name is required"),
  code: z.string().min(1, "Short name is required"),
  requiresSerialModel: z.boolean(),
})

type AssetTypeFormValues = z.infer<typeof assetTypeSchema>

interface NewAssetType {
  label: string
  code: string
  requiresSerialModel: boolean
}

interface AssetTypeDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  newAssetType: NewAssetType
  setNewAssetType: (value: NewAssetType) => void
  onCreateAssetType: () => void
  isCreatingAssetType: boolean
}

export function AssetTypeDialog({
  isOpen,
  onOpenChange,
  newAssetType,
  setNewAssetType,
  onCreateAssetType,
  isCreatingAssetType,
}: AssetTypeDialogProps) {
  const form = useForm<AssetTypeFormValues>({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: {
      label: newAssetType.label,
      code: newAssetType.code,
      requiresSerialModel: newAssetType.requiresSerialModel,
    },
  })

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  // Sync form state back to parent whenever values change
  useEffect(() => {
    const subscription = watch((values) => {
      setNewAssetType({
        label: values.label ?? "",
        code: values.code ?? "",
        requiresSerialModel: values.requiresSerialModel ?? false,
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, setNewAssetType])

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      form.reset({
        label: newAssetType.label,
        code: newAssetType.code,
        requiresSerialModel: newAssetType.requiresSerialModel,
      })
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const labelValue = watch("label")
  const codeValue = watch("code")

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Plus className="text-primary h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Create New Asset Type</DialogTitle>
              <DialogDescription className="mt-1">
                Add a new asset type that will be available for all assets
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="asset_type_label">Full Name *</Label>
            <Input
              id="asset_type_label"
              placeholder="e.g., Office Chair, Desktop Computer"
              {...register("label")}
              className="mt-1.5"
            />
            {errors.label && <p className="text-destructive mt-1 text-xs">{errors.label.message}</p>}
            <p className="text-muted-foreground mt-1 text-xs">The full name of the asset type</p>
          </div>
          <div>
            <Label htmlFor="asset_type_code">Short Name (Code) *</Label>
            <Input
              id="asset_type_code"
              placeholder="e.g., CHAIR, DSKST"
              value={codeValue}
              onChange={(e) => {
                const code = e.target.value.toUpperCase().replace(/\s+/g, "")
                setValue("code", code)
              }}
              className="mt-1.5 font-mono"
              maxLength={20}
            />
            {errors.code && <p className="text-destructive mt-1 text-xs">{errors.code.message}</p>}
            <p className="text-muted-foreground mt-1 text-xs">
              Short code used in unique asset codes (e.g., ACOB/HQ/CHAIR/24/001)
            </p>
          </div>
          <div className="bg-muted/50 flex items-center space-x-2 rounded-lg border p-3">
            <Checkbox
              id="requires_serial"
              checked={watch("requiresSerialModel")}
              onCheckedChange={(checked) => setValue("requiresSerialModel", checked === true)}
            />
            <Label htmlFor="requires_serial" className="cursor-pointer text-sm font-normal">
              Requires Serial Number &amp; Model
            </Label>
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreateAssetType} disabled={isCreatingAssetType || !labelValue.trim() || !codeValue.trim()}>
            {isCreatingAssetType ? "Creating..." : "Create Asset Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
