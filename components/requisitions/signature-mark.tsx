import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * A captured signature drawn on the printed form. Unoptimized: the signed URL
 * is short-lived and private, and the PDF is captured from the page as drawn.
 */
export function SignatureMark({ src, name, className }: { src: string; name?: string | null; className?: string }) {
  return (
    <Image
      src={src}
      alt={`Signature of ${name || "signer"}`}
      width={240}
      height={88}
      unoptimized
      className={cn("h-auto w-auto", className)}
    />
  )
}
