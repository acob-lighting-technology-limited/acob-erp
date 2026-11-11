import type { Metadata } from "next"
import { PayeeRegister } from "@/components/requisitions/schedules/payee-register"

export const metadata: Metadata = { title: "Payee register" }

export default function PayeeRegisterPage() {
  return <PayeeRegister />
}
