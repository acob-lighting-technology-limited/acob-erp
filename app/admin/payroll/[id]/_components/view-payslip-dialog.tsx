"use client"

import type { Dispatch, SetStateAction } from "react"
import type { PayrollRow, PayrollPeriodDetail } from "../view"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type PayrollBreakdown } from "@/lib/hr/payroll-utils"
import { printPayslip } from "@/lib/hr/payslip-print"
import { payslipFromBreakdown, type PayslipEmployeeMeta } from "@/lib/hr/payslip-types"
import { Printer, Mail } from "lucide-react"

interface ViewPayslipDialogProps {
  viewRow: PayrollRow | null
  setViewRow: Dispatch<SetStateAction<PayrollRow | null>>
  vb: PayrollBreakdown | undefined
  period: PayrollPeriodDetail
  status: string
  setEmailTarget: Dispatch<SetStateAction<PayrollRow | null>>
  payslipMeta: (row: PayrollRow) => PayslipEmployeeMeta
}

export function ViewPayslipDialog({
  viewRow,
  setViewRow,
  vb,
  period,
  status,
  setEmailTarget,
  payslipMeta,
}: ViewPayslipDialogProps) {
  return (
    <Dialog open={viewRow !== null} onOpenChange={(o) => !o && setViewRow(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>View Payslip</DialogTitle>
          <DialogDescription>
            Print or review the details of the employee&apos;s monthly salary breakdown.
          </DialogDescription>
        </DialogHeader>

        {viewRow && vb && (
          <div
            id="payslip-print-area"
            className="space-y-4 rounded-lg border bg-white p-5 text-sm text-zinc-900 shadow-sm"
          >
            {/* Header: Logo + Company Info + Payslip Label */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-3">
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
                  Period: <span className="font-semibold whitespace-nowrap text-gray-700">{period.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Pay Date: <span className="font-semibold whitespace-nowrap text-gray-700">{period.pay_date}</span>
                </p>
                <p
                  className="mt-1 text-xs font-bold uppercase"
                  style={{ color: status === "completed" ? "#059669" : "#d97706" }}
                >
                  ● {status === "completed" ? "Paid" : "Draft"}
                </p>
              </div>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-3 rounded border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs">
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Employee Name</p>
                <p className="font-semibold text-gray-800">{viewRow.full_name}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Staff ID</p>
                <p className="font-mono font-semibold text-gray-800">{viewRow.employee_number}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Department</p>
                <p className="font-semibold text-gray-800">{viewRow.department || "—"}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-gray-400 uppercase">Designation</p>
                <p className="font-semibold text-gray-800">{viewRow.designation || "—"}</p>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <div>
                <h3 className="mb-1.5 border-b border-emerald-200 pb-1 text-xs font-bold tracking-widest text-emerald-700 uppercase">
                  Earnings
                </h3>
                <table className="w-full">
                  <tbody>
                    {[
                      ["Basic Salary", vb.monthlyBasic],
                      ["Housing Allowance", vb.monthlyHousing],
                      ["Transport Allowance", vb.monthlyTransport],
                      ["Leave Allowance", vb.monthlyLeave],
                      ["Communication Allowance", vb.monthlyCommunication],
                      ...(vb.bonus > 0 ? [["Bonus / Refund", vb.bonus]] : []),
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
                      <td className="pt-1.5 font-bold text-gray-900">Gross Cash Pay</td>
                      <td className="pt-1.5 text-right font-bold text-gray-900">
                        ₦
                        {(vb.monthlyGross + vb.bonus).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-1.5 border-b border-red-200 pb-1 text-xs font-bold tracking-widest text-red-600 uppercase">
                  Deductions
                </h3>
                <table className="w-full">
                  <tbody>
                    {(() => {
                      const rows: [string, number][] = [
                        ["Pension (Employee)", vb.monthlyPensionEmployee],
                        ["PAYE Tax", vb.monthlyTax],
                      ]
                      if (vb.unpaidLeaveDeduction > 0)
                        rows.push([`Unpaid Leave (${vb.unpaidLeaveDays}d)`, vb.unpaidLeaveDeduction])
                      if (vb.lunchDeduction > 0) rows.push(["Lunch Deduction", vb.lunchDeduction])
                      if (vb.loanRepayment > 0) rows.push(["Loan Repayment", vb.loanRepayment])
                      if (vb.latenessSurcharge + vb.absentSurcharge > 0)
                        rows.push(["Lateness/Absence Surcharge", vb.latenessSurcharge + vb.absentSurcharge])
                      return rows.map(([label, val]) => (
                        <tr key={label} className="border-b border-gray-50">
                          <td className="py-1 text-gray-600">{label}</td>
                          <td className="py-1 text-right font-medium text-red-600">
                            ₦
                            {Number(val).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))
                    })()}
                    <tr className="border-t border-gray-200">
                      <td className="pt-1.5 font-bold text-gray-900">Total Deductions</td>
                      <td className="pt-1.5 text-right font-bold text-red-600">
                        ₦
                        {vb.totalDeductions.toLocaleString("en-US", {
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
                ₦{vb.netPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => setViewRow(null)}>
            Close
          </Button>
          <Button variant="outline" onClick={() => setEmailTarget(viewRow)} disabled={!viewRow || !vb}>
            <Mail className="mr-1.5 h-4 w-4" /> Email Payslip
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => {
              if (!viewRow || !vb) return
              printPayslip(payslipFromBreakdown(vb, payslipMeta(viewRow)))
            }}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print Payslip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
