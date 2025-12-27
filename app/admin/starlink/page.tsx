'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Satellite,
    Plus,
    Upload,
    AlertCircle,
    CheckCircle2,
    Clock,
    DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import type {
    StarlinkDashboardStats,
    StarlinkSiteWithPayments,
} from '@/types/starlink';
import {
    calculateDaysUntilPayment,
    formatCurrency,
    getUrgencyBadgeColor,
    getUrgencyText,
    formatPaymentPeriod,
} from '@/lib/starlink-utils';
import { toast } from 'sonner';

export default function StarlinkDashboardPage() {
    const [stats, setStats] = useState<StarlinkDashboardStats | null>(null);
    const [sites, setSites] = useState<StarlinkSiteWithPayments[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, sitesRes] = await Promise.all([
                fetch('/api/starlink/dashboard'),
                fetch('/api/starlink/sites'),
            ]);

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData.data);
            }

            if (sitesRes.ok) {
                const sitesData = await sitesRes.json();
                setSites(sitesData.data || []);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleImportExcel = async () => {
        try {
            setImporting(true);

            // Import data from the Excel file
            const sitesData = [
                {
                    state: 'Edo',
                    site_name: 'Ajegunle',
                    email: 'ajegunle@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10220671-51752-35',
                    invoice_number: 'INV-DF-NGA-1609551-40680-90',
                    billing_period: 'Your billing period is December 3 - January 2.',
                    next_payment_due: 'January 2, 2026.',
                },
                {
                    state: 'Edo',
                    site_name: 'Oloyan',
                    email: 'oloyan@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10224272-87960-46',
                    invoice_number: 'INV-DF-NGA-1609770-82172-95',
                    billing_period: 'Your billing period is December 3 - January 2.',
                    next_payment_due: 'January 2, 2026.',
                },
                {
                    state: 'Nasarawa',
                    site_name: 'Ogufa',
                    email: 'ogufa@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10041149-48436-41',
                    invoice_number: 'INV-DF-NGA-1578717-53107-97',
                    billing_period: 'Your billing period is November 23 - December 22.',
                    next_payment_due: 'December 22, 2025.',
                },
                {
                    state: 'Nasarawa',
                    site_name: 'Kyakale',
                    email: 'kyakale@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10039348-86576-56',
                    invoice_number: 'INV-DF-NGA-1578641-34636-99',
                    billing_period: 'Your billing period is November 23 - December 22.',
                    next_payment_due: 'December 22, 2025.',
                },
                {
                    state: 'Nasarawa',
                    site_name: 'Umuaisha',
                    email: 'umuaisha@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10043992-60105-36',
                    invoice_number: 'INV-DF-NGA-1578788-73470-10',
                    billing_period: 'Your billing period is November 23 - December 22.',
                    next_payment_due: 'December 22, 2025.',
                },
                {
                    state: 'Nasarawa',
                    site_name: 'Tunga',
                    email: 'tunga@org.acoblighting.com ',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10027839-61596-53',
                    invoice_number: 'INV-DF-NGA-1576225-89628-6',
                    billing_period: 'Your billing period is November 22 - December 21.',
                    next_payment_due: 'December 21, 2025.',
                },
                {
                    state: 'Nasarawa',
                    site_name: 'Musha',
                    email: 'musha@org.acoblighting.com',
                    phone_number: '+2347049202634',
                    serial_number: 'ACC-DF-10031475-12083-31',
                    invoice_number: 'INV-DF-NGA-1576299-86497-18',
                    billing_period: 'Your billing period is November 22 - December 21.',
                    next_payment_due: 'December 21, 2025.',
                },
            ];

            const response = await fetch('/api/starlink/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sites: sitesData }),
            });

            const result = await response.json();

            if (response.ok) {
                toast.success(
                    `Import completed: ${result.results.success} successful, ${result.results.failed} failed`
                );
                fetchDashboardData();
            } else {
                toast.error(result.error || 'Import failed');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            toast.error('Failed to import data');
        } finally {
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <Satellite className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                                Starlink Payment Management
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Track payment schedules and manage documents for all Starlink sites
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleImportExcel}
                            disabled={importing}
                            variant="outline"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {importing ? 'Importing...' : 'Import Excel Data'}
                        </Button>
                        <Link href="/admin/starlink/sites/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Site
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Total Sites
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">
                                        {stats?.total_sites || 0}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                    <Satellite className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Due This Week
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">
                                        {stats?.payments_due_this_week || 0}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Pending Payments
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">
                                        {stats?.pending_payments || 0}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Total Pending
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">
                                        {formatCurrency(stats?.total_amount_pending || 0)}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Upcoming Payments Alert */}
                {stats?.upcoming_payments && stats.upcoming_payments.length > 0 && (
                    <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-orange-900 dark:text-orange-100">
                                <AlertCircle className="h-5 w-5" />
                                Upcoming Payments (Next 7 Days)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {stats.upcoming_payments.map((payment, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-gray-900"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">
                                                {payment.site_name} ({payment.state})
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Due: {new Date(payment.due_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {payment.amount && (
                                                <span className="text-sm font-medium">
                                                    {formatCurrency(payment.amount)}
                                                </span>
                                            )}
                                            <Badge className={getUrgencyBadgeColor(payment.days_until_due)}>
                                                {getUrgencyText(payment.days_until_due)}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Sites List */}
                <Card>
                    <CardHeader>
                        <CardTitle>All Sites</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sites.length === 0 ? (
                            <div className="py-12 text-center">
                                <Satellite className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-muted-foreground">
                                    No sites found. Import your Excel data or add a new site.
                                </p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <Button onClick={handleImportExcel} disabled={importing}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import Excel Data
                                    </Button>
                                    <Link href="/admin/starlink/sites/new">
                                        <Button variant="outline">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Site
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sites.map((site) => {
                                    const daysUntil = site.days_until_due;
                                    const isUrgent = daysUntil !== null && daysUntil !== undefined && daysUntil <= 7;

                                    return (
                                        <div
                                            key={site.id}
                                            className={`flex items-center justify-between rounded-lg border p-4 transition-all hover:shadow-md ${isUrgent
                                                ? 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20'
                                                : ''
                                                }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-foreground">
                                                        {site.site_name}
                                                    </h3>
                                                    <Badge variant="outline" className="text-xs">
                                                        {site.state}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {site.email} • {site.phone_number}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Serial: {site.serial_number}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {site.latest_payment && (
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-foreground">
                                                            Next Payment
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(
                                                                site.latest_payment.next_payment_due
                                                            ).toLocaleDateString()}
                                                        </p>
                                                        {daysUntil !== null && daysUntil !== undefined && (
                                                            <Badge
                                                                className={`mt-1 ${getUrgencyBadgeColor(daysUntil)}`}
                                                            >
                                                                {daysUntil < 0
                                                                    ? `${Math.abs(daysUntil)} days overdue`
                                                                    : `${daysUntil} days left`}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}

                                                <Link href={`/admin/starlink/sites/${site.id}`}>
                                                    <Button variant="outline" size="sm">
                                                        View Details
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
