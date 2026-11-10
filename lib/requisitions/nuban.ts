/**
 * NUBAN check digits for Nigerian bank account numbers (CBN NUBAN standard).
 *
 * A NUBAN is a 9-digit serial plus a check digit. The check digit is worked out
 * from the bank's code and the serial, so a mistyped digit, or the right number
 * under the wrong bank, almost always fails. It says nothing about who owns the
 * account; the Paystack name check does that.
 *
 * Only commercial banks are checked. Fintechs and microfinance banks (OPay,
 * PalmPay, Moniepoint, Kuda…) often use the owner's phone number as the account
 * number, which does not follow the check digit, so checking them would reject
 * real accounts. Their codes are kept for the Paystack lookup.
 */

export interface NigerianBank {
  name: string
  /** CBN/NIBSS code, as Paystack's List Banks returns it. */
  code: string
  /** True when this bank's account numbers follow the NUBAN check digit. */
  nuban: boolean
}

export const NIGERIAN_BANKS: readonly NigerianBank[] = [
  { name: "Access Bank", code: "044", nuban: true },
  { name: "Citibank Nigeria", code: "023", nuban: true },
  { name: "Ecobank Nigeria", code: "050", nuban: true },
  { name: "Fidelity Bank", code: "070", nuban: true },
  { name: "First Bank of Nigeria", code: "011", nuban: true },
  { name: "First City Monument Bank (FCMB)", code: "214", nuban: true },
  { name: "Guaranty Trust Bank (GTBank)", code: "058", nuban: true },
  { name: "Jaiz Bank", code: "301", nuban: true },
  { name: "Keystone Bank", code: "082", nuban: true },
  { name: "Lotus Bank", code: "303", nuban: true },
  { name: "Polaris Bank", code: "076", nuban: true },
  { name: "Providus Bank", code: "101", nuban: true },
  { name: "Stanbic IBTC Bank", code: "221", nuban: true },
  { name: "Standard Chartered Bank", code: "068", nuban: true },
  { name: "Sterling Bank", code: "232", nuban: true },
  { name: "SunTrust Bank", code: "100", nuban: true },
  { name: "TAJ Bank", code: "302", nuban: true },
  { name: "Titan Trust Bank", code: "102", nuban: true },
  { name: "Union Bank of Nigeria", code: "032", nuban: true },
  { name: "United Bank for Africa (UBA)", code: "033", nuban: true },
  { name: "Unity Bank", code: "215", nuban: true },
  { name: "Wema Bank", code: "035", nuban: true },
  { name: "Zenith Bank", code: "057", nuban: true },
  // Newer banks: checked once their codes are confirmed against Paystack's list.
  { name: "Globus Bank", code: "00103", nuban: false },
  { name: "Optimus Bank", code: "107", nuban: false },
  { name: "PremiumTrust Bank", code: "105", nuban: false },
  { name: "Signature Bank", code: "106", nuban: false },
  // Fintechs and microfinance banks: phone-number accounts, never checked.
  { name: "FairMoney MFB", code: "51318", nuban: false },
  { name: "Kuda MFB", code: "50211", nuban: false },
  { name: "Moniepoint MFB", code: "50515", nuban: false },
  { name: "OPay", code: "999992", nuban: false },
  { name: "PalmPay", code: "999991", nuban: false },
  { name: "VFD MFB", code: "566", nuban: false },
]

/** The NUBAN weights, repeated over the 6-digit bank code and the 9-digit serial. */
const WEIGHTS = [3, 7, 3] as const

/** Check digit for a 9-digit serial at a bank (3-digit codes are padded to 6). */
export function nubanCheckDigit(bankCode: string, serial: string): number {
  const digits = bankCode.padStart(6, "0") + serial
  let sum = 0
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * WEIGHTS[i % 3]
  return (10 - (sum % 10)) % 10
}

export function isNubanValid(accountNumber: string, bankCode: string): boolean {
  if (!/^\d{10}$/.test(accountNumber) || !/^\d{1,6}$/.test(bankCode)) return false
  return nubanCheckDigit(bankCode, accountNumber.slice(0, 9)) === Number(accountNumber[9])
}

/**
 * Whether the name someone typed is the account holder's name the bank gave.
 * Banks print names in their own order and case ("ADEBAYO JOHN OLUWASEUN"),
 * so every typed word must appear in the bank's name, in any order.
 */
export function accountNamesMatch(typed: string, fromBank: string): boolean {
  const words = (s: string) => s.toUpperCase().match(/[A-Z0-9]+/g) ?? []
  const bank = new Set(words(fromBank))
  const mine = words(typed).filter((w) => w.length > 1)
  return mine.length > 0 && mine.every((w) => bank.has(w))
}

/** Checked banks whose format this account number fits. */
export function banksFittingNuban(accountNumber: string): NigerianBank[] {
  return NIGERIAN_BANKS.filter((b) => b.nuban && isNubanValid(accountNumber, b.code))
}

export type NubanResult =
  /** Not 10 digits yet, no bank, or a bank we do not check: say nothing. */
  | { status: "unchecked" }
  | { status: "valid"; bank: NigerianBank }
  /** `fits` lists other checked banks the number would be valid at. */
  | { status: "invalid"; bank: NigerianBank; fits: NigerianBank[] }

export function checkNuban(accountNumber: string, bank: NigerianBank | null | undefined): NubanResult {
  if (!bank?.nuban || !/^\d{10}$/.test(accountNumber)) return { status: "unchecked" }
  if (isNubanValid(accountNumber, bank.code)) return { status: "valid", bank }
  return { status: "invalid", bank, fits: banksFittingNuban(accountNumber) }
}
