"use client"

import { useQuery } from "@tanstack/react-query"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

export interface SavedBeneficiary {
  account_name: string
  account_number: string
  bank_name: string
  bank_code: string
}

/**
 * "Use a saved account": accounts this person has paid on their own earlier
 * requisitions. Picking one fills the number and bank; the bank then confirms
 * the name as usual. Hidden when there is nothing saved.
 */
export function SavedBeneficiaryPicker({
  index,
  onPick,
}: {
  index: number
  onPick: (saved: SavedBeneficiary) => void
}) {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.requisitionSavedPayees(),
    queryFn: () => apiJson<{ data: SavedBeneficiary[] }>("/api/requisitions/payees/mine"),
    staleTime: 60_000,
  })
  const saved = data?.data || []
  if (!saved.length) return null
  const key = (s: SavedBeneficiary) => `${s.bank_code}:${s.account_number}`
  return (
    <SearchableSelect
      value=""
      onValueChange={(value) => {
        const pick = saved.find((s) => key(s) === value)
        if (pick) onPick(pick)
      }}
      options={saved.map((s) => ({ value: key(s), label: `${s.account_name} · ${s.bank_name} ${s.account_number}` }))}
      placeholder={`Use a saved account for beneficiary ${index + 1}`}
      searchPlaceholder="Search saved accounts"
    />
  )
}
