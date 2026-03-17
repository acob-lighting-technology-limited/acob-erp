import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Building2, CheckCircle, Calendar } from "lucide-react"

interface PaymentStats {
  totalDue: number
  totalPaid: number
  countCompleted: number
  countOverdue: number
  countDue: number
}

interface PaymentStatsCardsProps {
  stats: PaymentStats
  formatCurrency: (amount: number, currency: string) => string
}

export function PaymentStatsCards({ stats, formatCurrency }: PaymentStatsCardsProps) {
  return (
    <div className="grid grid-cols-6 gap-2 md:gap-3 lg:grid-cols-5">
      <Card className="col-span-6 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-[10px] font-medium md:text-sm">Total Outstanding</CardTitle>
          <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-base font-bold md:text-2xl">{formatCurrency(stats.totalDue, "NGN")}</div>
          <p className="text-muted-foreground text-[9px] md:text-xs">Overdue + Up Next (7 days)</p>
        </CardContent>
      </Card>
      <Card className="col-span-6 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-[10px] font-medium md:text-sm">Total Paid</CardTitle>
          <Building2 className="text-muted-foreground h-3.5 w-3.5" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-base font-bold md:text-2xl">{formatCurrency(stats.totalPaid, "NGN")}</div>
          <p className="text-muted-foreground text-[9px] md:text-xs">Lifetime collected</p>
        </CardContent>
      </Card>
      <Card className="col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-[10px] font-medium md:text-sm">Completed</CardTitle>
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-base font-bold text-green-600 md:text-2xl">{stats.countCompleted}</div>
          <p className="text-muted-foreground text-[9px] md:text-xs">Paid Items & History</p>
        </CardContent>
      </Card>
      <Card className="col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-[10px] font-medium md:text-sm">Overdue Payments</CardTitle>
          <CreditCard className="h-3.5 w-3.5 text-red-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-base font-bold text-red-600 md:text-2xl">{stats.countOverdue}</div>
          <p className="text-muted-foreground text-[9px] md:text-xs">Requires immediate attention</p>
        </CardContent>
      </Card>
      <Card className="col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-[10px] font-medium md:text-sm">Due Payments</CardTitle>
          <Calendar className="h-3.5 w-3.5 text-yellow-500" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-base font-bold text-yellow-600 md:text-2xl">{stats.countDue}</div>
          <p className="text-muted-foreground text-[9px] md:text-xs">Due within 7 days</p>
        </CardContent>
      </Card>
    </div>
  )
}
