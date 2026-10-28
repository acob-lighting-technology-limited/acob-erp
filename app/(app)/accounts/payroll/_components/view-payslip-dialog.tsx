"use client"

import type { Dispatch, SetStateAction } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer } from "lucide-react"
import type { UserPayrollEntry } from "../page"

interface ViewPayslipDialogProps {
  selectedEntry: UserPayrollEntry | null
  setSelectedEntry: Dispatch<SetStateAction<UserPayrollEntry | null>>
  profile: {
    id: string
    full_name: string
    employee_number: string
    department: string | null
    designation: string | null
  } | null
  basic: number
  housing: number
  transport: number
  leave: number
  comms: number
  bonus: number
  pensionEE: number
  tax: number
  lunch: number
  loan: number
  latenessSurcharge: number
  handlePrint: () => void
}

export function ViewPayslipDialog({
  selectedEntry,
  setSelectedEntry,
  profile,
  basic,
  housing,
  transport,
  leave,
  comms,
  bonus,
  pensionEE,
  tax,
  lunch,
  loan,
  latenessSurcharge,
  handlePrint,
}: ViewPayslipDialogProps) {
  return (
    <Dialog open={selectedEntry !== null} onOpenChange={(o) => !o && setSelectedEntry(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>View Payslip</DialogTitle>
          <DialogDescription>Print or review the details of your monthly salary breakdown.</DialogDescription>
        </DialogHeader>

        {selectedEntry && (
          <div
            id="payslip-print-area"
            className="space-y-4 rounded-lg border bg-white p-5 text-sm text-zinc-900 shadow-sm"
          >
            {/* Header: Logo + Company Info + Payslip Label */}
            <div className="flex items-start justify-between border-b border-gray-200 pb-3">
              <div>
                <Image
                  src="/images/exports/acob-lighting-full.png"
                  alt="ACOB Lighting Technology Limited"
                  width={200}
                  height={56}
                  className="object-contain"
                  unoptimized
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Plot 2. Block 14 Extension, Federal Ministry of Works And Housing Sites and Services Scheme, Setraco
                  Gate, Gwarinpa, FCT, Nigeria.
                </p>
                <p className="text-xs text-gray-500">
                  Email: info@acoblighting.com &nbsp;|&nbsp; Web: www.acoblighting.com
                </p>
              </div>
              <div className="min-w-[130px] text-right">
                <p className="text-xs font-bold text-emerald-700 uppercase">Payslip</p>
                <p className="text-xs text-gray-500">
                  Period:{" "}
                  <span className="font-semibold whitespace-nowrap text-gray-700">
                    {selectedEntry.payroll_periods?.name}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  Pay Date:{" "}
                  <span className="font-semibold whitespace-nowrap text-gray-700">
                    {selectedEntry.payroll_periods?.pay_date}
                  </span>
                </p>
                <p className="mt-1 text-xs font-bold text-emerald-600 uppercase">● Paid</p>
              </div>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-3 rounded border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs">
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Employee Name</p>
                <p className="font-semibold text-gray-800">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Staff ID</p>
                <p className="font-mono font-semibold text-gray-800">{profile?.employee_number}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Department</p>
                <p className="font-semibold text-gray-800">{profile?.department || "—"}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Designation</p>
                <p className="font-semibold text-gray-800">{profile?.designation || "—"}</p>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div>
                <h3 className="mb-1.5 border-b border-emerald-200 pb-1 text-xs font-bold tracking-widest text-emerald-700 uppercase">
                  Earnings
                </h3>
                <table className="w-full">
                  <tbody>
                    {[
                      ["Basic Salary", basic],
                      ["Housing Allowance", housing],
                      ["Transport Allowance", transport],
                      ["Leave Allowance", leave],
                      ["Communication Allowance", comms],
                      ...(bonus > 0 ? [["Bonus / Refunds", bonus]] : []),
                    ].map(([label, val]) => (
                      <tr key={String(label)} className="border-b border-gray-50">
                        <td className="py-1 text-gray-600">{label}</td>
                        <td className="py-1 text-right font-medium text-gray-800">
                          ₦
                          {Number(val).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200">
                      <td className="pt-1.5 font-bold text-gray-900">Total Gross</td>
                      <td className="pt-1.5 text-right font-bold text-gray-900">
                        ₦
                        {(Number(selectedEntry.gross_salary) + bonus).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="mb-1.5 border-b border-red-200 pb-1 text-xs font-bold tracking-widest text-red-600 uppercase">
                  Deductions
                </h3>
                <table className="w-full">
                  <tbody>
                    {[
                      ["Pension (8% of Basic)", pensionEE],
                      ["PAYE Tax", tax],
                      ...(lunch > 0 ? [["Staff Lunch Deduction", lunch]] : []),
                      ...(loan > 0 ? [["Loan Repayment", loan]] : []),
                      ...(latenessSurcharge > 0 ? [["Lateness / Absence Surcharge", latenessSurcharge]] : []),
                    ].map(([label, val]) => (
                      <tr key={String(label)} className="border-b border-gray-50">
                        <td className="py-1 text-gray-600">{label}</td>
                        <td className="py-1 text-right font-medium text-red-600">
                          ₦
                          {Number(val).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200">
                      <td className="pt-1.5 font-bold text-gray-900">Total Deductions</td>
                      <td className="pt-1.5 text-right font-bold text-red-600">
                        -₦
                        {Number(selectedEntry.total_deductions).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Pay Banner */}
            <div className="flex items-center justify-between rounded-lg bg-emerald-600 px-5 py-3 text-white">
              <span className="text-xs font-bold tracking-widest uppercase">Net Pay (Take Home)</span>
              <span className="text-lg font-extrabold">
                ₦
                {Number(selectedEntry.net_salary).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {/* Signature Lines */}
            <div className="flex items-end justify-between pt-6 text-xs text-gray-400">
              <div className="w-36 border-t border-gray-300 pt-1 text-center">Employee Signature</div>
              <div className="text-center text-xs text-gray-300">
                This payslip is computer-generated and valid without a signature.
              </div>
              <div className="w-36 border-t border-gray-300 pt-1 text-center">Authorised Signatory</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => setSelectedEntry(null)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" /> Print Payslip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
