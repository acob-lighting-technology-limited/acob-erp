import { NIGERIAN_BANKS } from "./nuban"
import type { PaymentScheduleItem } from "./types"

/**
 * The Zenith corporate bulk-upload file Accounts sends the MD: one row per
 * beneficiary line, columns in the bank's order, header text exactly as the
 * bank's template has it.
 */
export const BANK_FILE_HEADERS = [
  "TRANSACTION REFERENCE NUMBER (MANDATORY FIELD) This is a unique reference created by the payer and used to identify a payment. Must not contain commas semi-colon apostrophe or space. Text format. Alpha-numeric(max. 30 characters)",
  "BENEFICIARY NAME (MANDATORY FIELD) Text format. Alpha-numeric(max. 100 characters)",
  "PAYMENT AMOUNT (MANDATORY FIELD) Number format with 2 decimal digits. Must not contain commas semi-colon apostrophe or spaces",
  "PAYMENT DUE DATE (MANDATORY FIELD) This is the effective date of payment. Format is DD/MM/YYYY (max. 10 characters)",
  "BENEFICIARY CODE (MANDATORY FIELD) Unique code assigned by Payer to the beneficiary. Used on Corporate I-Bank to search for payments made to the beneficiary. Alphanumeric e.g. staff number. RC no. or name (max. 35 characters)",
  "BENEFICIARY ACCOUNT NUMBER (MANDATORY FIELD) Numeric (10 digits)",
  "BENEFICIARY BANK SORT CODE (MANDATORY FIELD) This is used to represent Beneficiary Bank Name and Payment routing method. Leave blank for Zenith beneficiaries. Use first 3-digits for Instant transfer via InterSwitch. Use 9-digits for non-instant transfer via NEFT",
  "DEBIT ACCOUNT NUMBER (MANDATORY FIELD) This is the account number to debit. Number format (max. 10 digits)",
] as const

export interface BankFileRow {
  reference: string
  name: string
  amount: number
  /** yyyy-mm-dd */
  dueDate: string
  beneficiaryCode: string
  accountNumber: string
  /** The bank code as a number, the way Accounts' own schedule has it (057 → 57). */
  sortCode: number
  debitAccount: string
}

export function bankFileRows(
  items: Pick<
    PaymentScheduleItem,
    "transaction_ref" | "account_name" | "amount" | "beneficiary_code" | "account_number" | "bank_code"
  >[],
  paymentDate: string,
  debitAccount: string
): BankFileRow[] {
  return items.map((item) => ({
    reference: item.transaction_ref,
    name: item.account_name.toUpperCase().slice(0, 100),
    amount: Math.round(Number(item.amount) * 100) / 100,
    dueDate: paymentDate,
    beneficiaryCode: item.beneficiary_code.slice(0, 35),
    accountNumber: item.account_number,
    sortCode: Number(item.bank_code),
    debitAccount,
  }))
}

/** dd/mm/yyyy from yyyy-mm-dd. */
export function bankDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function normaliseBankName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(bank|plc|nigeria|limited|ltd|of|mfb|microfinance)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const ALIASES: Record<string, string> = {
  gtb: "058",
  gtbank: "058",
  "guaranty trust": "058",
  uba: "033",
  fcmb: "214",
  firstbank: "011",
  "first bank": "011",
  fbn: "011",
  stanbic: "221",
  eco: "050",
  ecobank: "050",
  moniepoint: "50515",
  opay: "999992",
  palmpay: "999991",
  kuda: "50211",
}

/**
 * The bank code for a bank name typed before banks were picked from a list
 * ("ACCESS", "Zenith Bank", "GTB"). Null when it is unclear; the officer picks.
 */
export function bankCodeForName(name: string | null | undefined): string | null {
  const wanted = normaliseBankName(name || "")
  if (!wanted) return null
  if (ALIASES[wanted]) return ALIASES[wanted]
  const exact = NIGERIAN_BANKS.filter((b) => normaliseBankName(b.name) === wanted)
  if (exact.length === 1) return exact[0].code
  const partial = NIGERIAN_BANKS.filter((b) => {
    const bank = normaliseBankName(b.name)
    return bank.startsWith(wanted) || wanted.startsWith(bank)
  })
  return partial.length === 1 ? partial[0].code : null
}

export function bankNameForCode(code: string | null | undefined): string | null {
  return NIGERIAN_BANKS.find((b) => b.code === code)?.name ?? null
}
