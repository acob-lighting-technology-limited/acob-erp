import { cn } from "@/lib/utils"

interface FormFieldGroupProps {
  label: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormFieldGroup({ label, description, error, required, className, children }: FormFieldGroupProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
