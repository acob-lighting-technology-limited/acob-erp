'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Search,
    Filter,
    Download,
    CreditCard,
    MoreVertical,
    Eye,
    Trash2,
    Building2,
    Calendar,
    Phone,
    MapPin,
    FileText,
    ArrowUpDown,
    FileSpreadsheet,
    FileIcon,
    Printer,
    CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, parseISO, isValid, differenceInDays, isBefore, startOfDay } from 'date-fns';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Interfaces match the previous implementation
interface Payment {
    id: string;
    department_id: string;
    title: string;
    amount: number;
    currency: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    payment_type: 'one-time' | 'recurring';
    recurrence_period?: 'monthly' | 'quarterly' | 'yearly';
    next_payment_due?: string;
    payment_date?: string;
    category: string;
    description?: string;
    issuer_name?: string;
    issuer_phone_number?: string;
    issuer_address?: string;
    payment_reference?: string;
    amount_paid?: number;
    created_at: string;
    department?: {
        name: string;
    };
    documents?: {
        id: string;
        document_type: string;
        file_path: string;
        file_name?: string;
    }[];
}

interface Department {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
}

interface FormData {
    department_id: string;
    category: string; // Storing the name/text directly for now
    title: string;
    description: string;
    amount: string;
    currency: string;
    recurrence_period: string;
    next_payment_due: string;
    payment_date: string;
    issuer_name: string;
    issuer_phone_number: string;
    issuer_address: string;
    payment_reference: string;
    notes: string;
    payment_type: 'one-time' | 'recurring';
}

export default function PaymentsPage() {
    const router = useRouter();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        department_id: '',
        category: '',
        title: '',
        description: '',
        amount: '',
        currency: 'NGN',
        recurrence_period: 'monthly',
        next_payment_due: '',
        payment_date: '',
        issuer_name: '',
        issuer_phone_number: '',
        issuer_address: '',
        payment_reference: '',
        notes: '',
        payment_type: 'one-time'
    });

    useEffect(() => {
        fetchData();
        fetchAuxData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/payments');
            const data = await response.json();
            if (response.ok) {
                setPayments(data.data || []);
            }
        } catch (error) {
            toast.error('Failed to fetch payments');
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxData = async () => {
        try {
            const [deptRes, catRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/payments/categories')
            ]);

            if (deptRes.ok) {
                const data = await deptRes.json();
                setDepartments(data.data || []);
            }
            if (catRes.ok) {
                const data = await catRes.json();
                setCategories(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch aux data', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Validation
            if (!formData.department_id || !formData.category || !formData.amount || !formData.title || !formData.issuer_name || !formData.issuer_phone_number) {
                toast.error('Please fill in all required fields (including Issuer Name & Phone)');
                setSubmitting(false);
                return;
            }

            if (formData.payment_type === 'recurring' && (!formData.recurrence_period || !formData.next_payment_due)) {
                toast.error('Recurring payments require a period and start date');
                setSubmitting(false);
                return;
            }

            if (formData.payment_type === 'one-time' && !formData.payment_date) {
                toast.error('One-time payments require a payment date');
                setSubmitting(false);
                return;
            }

            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount),
                }),
            });

            if (response.ok) {
                toast.success('Payment created successfully');
                setIsModalOpen(false);
                setFormData({
                    department_id: '',
                    category: '',
                    title: '',
                    description: '',
                    amount: '',
                    currency: 'NGN',
                    recurrence_period: 'monthly',
                    next_payment_due: '',
                    payment_date: '',
                    issuer_name: '',
                    issuer_phone_number: '',
                    issuer_address: '',
                    payment_reference: '',
                    notes: '',
                    payment_type: 'one-time'
                });
                fetchData();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to create payment');
            }
        } catch (error) {
            toast.error('Error creating payment');
        } finally {
            setSubmitting(false);
        }
    };

    // Compute dynamic status to handle overdue logic on the client
    const getRealStatus = (p: Payment) => {
        if (p.status === 'paid' || p.status === 'cancelled') return p.status;
        const dateStr = p.payment_type === 'recurring' ? p.next_payment_due : p.payment_date;
        if (!dateStr) return p.status;
        const date = parseISO(dateStr);
        if (!isValid(date)) return p.status;

        if (isBefore(date, startOfDay(new Date()))) {
            return 'overdue';
        }
        return p.status;
    };

    const processedPayments = payments.map(p => ({
        ...p,
        status: getRealStatus(p)
    }));

    // Calculate Stats
    const stats = {
        totalDue: processedPayments
            .filter(p => {
                if (p.status === 'overdue') return true;
                if (p.status === 'pending') {
                    const dateStr = p.payment_type === 'recurring' ? p.next_payment_due : p.payment_date;
                    if (!dateStr) return true;
                    return differenceInDays(parseISO(dateStr), new Date()) <= 7;
                }
                return false;
            })
            .reduce((sum, p) => sum + p.amount, 0),
        totalPaid: processedPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0),
        countCompleted: processedPayments.filter(p => p.status === 'paid' || (p.amount_paid && p.amount_paid > 0)).length,
        countOverdue: processedPayments.filter(p => p.status === 'overdue').length,
        countPending: processedPayments.filter(p => p.status === 'pending').length,
    };

    // Filter Logic
    const filteredPayments = processedPayments.filter((payment) => {
        const matchesSearch =
            payment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (payment.department?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (payment.issuer_name || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDepartment =
            departmentFilter === 'all' || payment.department_id === departmentFilter;

        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesType = typeFilter === 'all' || payment.payment_type === typeFilter;

        return matchesSearch && matchesDepartment && matchesStatus && matchesType;
    });

    // Sorting Logic
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedPayments = [...filteredPayments].sort((a, b) => {
        if (!sortConfig) return 0;

        let valA: any = a;
        let valB: any = b;

        if (sortConfig.key === 'date') {
            valA = a.payment_type === 'recurring' ? a.next_payment_due : a.payment_date;
            valB = b.payment_type === 'recurring' ? b.next_payment_due : b.payment_date;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Exports
    const exportToCSV = () => {
        const headers = ['S/N', 'Category', 'Title', 'Issuer', 'Department', 'Amount', 'Type', 'Status', 'Date', 'Reference'];
        const csvContent = [
            headers.join(','),
            ...sortedPayments.map((p, i) => [
                i + 1,
                `"${(p.category || '').replace(/"/g, '""')}"`,
                `"${p.title.replace(/"/g, '""')}"`,
                `"${(p.issuer_name || '').replace(/"/g, '""')}"`,
                `"${(p.department?.name || '').replace(/"/g, '""')}"`,
                p.amount,
                p.payment_type,
                p.status,
                p.payment_type === 'recurring' ? p.next_payment_due : p.payment_date,
                `"${p.id.substring(0, 8)}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `payments_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToXLSX = () => {
        const data = sortedPayments.map((p, i) => ({
            'S/N': i + 1,
            'Category': p.category,
            'Title': p.title,
            'Issuer': p.issuer_name || '',
            'Department': p.department?.name || '',
            'Amount': p.amount,
            'Currency': p.currency,
            'Type': p.payment_type,
            'Status': p.status,
            'Date': p.payment_type === 'recurring' ? p.next_payment_due : p.payment_date,
            'Reference': p.id
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payments");
        XLSX.writeFile(wb, `payments_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();

        const tableColumn = ["S/N", "Category", "Title", "Issuer", "Department", "Amount", "Status", "Date"];
        const tableRows: any[] = [];

        sortedPayments.forEach((p, i) => {
            const date = p.payment_type === 'recurring' ? p.next_payment_due : p.payment_date;
            const formattedDate = date && isValid(parseISO(date)) ? format(parseISO(date), 'MMM d, yyyy') : 'N/A';
            const paymentData = [
                i + 1,
                p.category || '',
                p.title,
                p.issuer_name || 'N/A',
                p.department?.name || 'N/A',
                `${p.currency} ${p.amount.toLocaleString()}`,
                p.status,
                formattedDate
            ];
            tableRows.push(paymentData);
        });

        doc.text("Payments Report", 14, 15);
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            headStyles: { fillColor: [22, 163, 74] }, // Green
        });
        doc.save(`payments_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const handlePrintDetails = (payment: Payment) => {
        const doc = new jsPDF();

        // Header Background
        doc.setFillColor(22, 163, 74); // Green
        doc.rect(0, 0, 210, 40, 'F');

        // Header Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("PAYMENT DETAILS", 105, 25, { align: 'center', baseline: 'middle' });

        // Basic Info
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Reference: ${payment.id.substring(0, 8).toUpperCase()}`, 14, 50);

        const date = payment.payment_type === 'recurring' ? payment.next_payment_due : payment.payment_date;
        const formattedDate = date && isValid(parseISO(date)) ? format(parseISO(date), 'MMM d, yyyy') : 'N/A';
        doc.text(`Date: ${formattedDate}`, 196, 50, { align: 'right' });

        // Divider
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 55, 196, 55);

        // Title & Amount
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(payment.title, 14, 65);

        doc.setFontSize(20);
        doc.setTextColor(22, 163, 74);
        doc.text(`${payment.currency} ${payment.amount.toLocaleString()}`, 196, 65, { align: 'right' });

        // Divider 2
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 75, 196, 75);

        // Grid Layout
        let y = 90;
        const leftCol = 14;
        const rightCol = 110;
        const labelOffset = 35;
        const rowHeight = 12;

        doc.setFontSize(11);

        const printRow = (label: string, value: string, x: number) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, x, y);
            doc.setFont('helvetica', 'normal');
            doc.text(value, x + labelOffset, y);
        };

        // Row 1
        printRow("Category:", payment.category || 'N/A', leftCol);
        printRow("Department:", payment.department?.name || 'N/A', rightCol);
        y += rowHeight;

        // Row 2
        printRow("Issuer:", payment.issuer_name || 'N/A', leftCol);
        printRow("Status:", payment.status.toUpperCase(), rightCol);
        y += rowHeight;

        // Row 3
        printRow("Phone:", payment.issuer_phone_number || 'N/A', leftCol);
        printRow("Type:", payment.payment_type === 'recurring' ? 'Recurring' : 'One-time', rightCol);
        y += rowHeight;

        // Row 4
        if (payment.issuer_address) {
            printRow("Address:", payment.issuer_address, leftCol);
        }
        if (payment.recurrence_period) {
            printRow("Period:", payment.recurrence_period, rightCol);
        }

        // Description / Notes
        if (payment.description) {
            y += rowHeight * 1.5;
            doc.setFont('helvetica', 'bold');
            doc.text("Description:", leftCol, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const splitDesc = doc.splitTextToSize(payment.description, 180);
            doc.text(splitDesc, leftCol, y);
        }

        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Generated by Payment System", 105, pageHeight - 10, { align: 'center' });

        doc.save(`payment_${payment.id}_details.pdf`);
    };

    const handlePrintDocument = (payment: Payment, type: 'invoice' | 'receipt') => {
        const doc = payment.documents?.find(d => d.document_type === type);
        if (doc) {
            const supabase = createClient();
            const { data } = supabase.storage.from('payment_documents').getPublicUrl(doc.file_path);
            if (data?.publicUrl) {
                window.open(data.publicUrl, '_blank');
            } else {
                toast.error('Could not get document URL');
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
            default: return '';
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                    <p className="text-muted-foreground">
                        Manage and track department payments and recurring subscriptions.
                    </p>
                </div>
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={exportToCSV}>
                                <FileText className="mr-2 h-4 w-4" /> CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportToXLSX}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportToPDF}>
                                <FileIcon className="mr-2 h-4 w-4" /> PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Payment
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalDue, 'NGN')}</div>
                        <p className="text-xs text-muted-foreground">
                            Overdue + Up Next (7 days)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalPaid, 'NGN')}</div>
                        <p className="text-xs text-muted-foreground">
                            Lifetime collected
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.countCompleted}</div>
                        <p className="text-xs text-muted-foreground">
                            Paid Items & History
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
                        <CreditCard className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.countOverdue}</div>
                        <p className="text-xs text-muted-foreground">
                            Requires immediate attention
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.countPending}</div>
                        <p className="text-xs text-muted-foreground">
                            Active Schedules & Upcoming
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search payments by title, department or issuer..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-40 animate-pulse rounded-lg border bg-muted" />
                    ))}
                </div>
            ) : sortedPayments.length === 0 ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                    <CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No payments found</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                        Get started by creating your first payment record.
                    </p>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Payment
                    </Button>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">S/N</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Issuer</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1">
                                        Date / Next Due
                                        <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPayments.map((payment, index) => (
                                <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/payments/${payment.id}`)}>
                                    <TableCell className="font-medium text-muted-foreground">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell>{payment.category}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{payment.title}</span>
                                            <span className="text-xs text-muted-foreground capitalize">{payment.payment_type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{payment.issuer_name || 'N/A'}</span>
                                            <span className="text-xs text-muted-foreground">{payment.issuer_phone_number || ''}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{payment.department?.name || 'Unknown'}</TableCell>
                                    <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                                    <TableCell>
                                        <Badge className={getStatusColor(payment.status)} variant="outline">
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {payment.payment_type === 'recurring' ? (
                                            <span className={payment.status === 'overdue' ? 'text-red-500 font-medium' : ''}>
                                                {payment.next_payment_due ? format(parseISO(payment.next_payment_due), 'MMM d, yyyy') : 'N/A'}
                                            </span>
                                        ) : (
                                            <span>
                                                {payment.payment_date ? format(parseISO(payment.payment_date), 'MMM d, yyyy') : 'N/A'}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="mr-2" onClick={(e) => e.stopPropagation()}>
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenuLabel>Print Options</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handlePrintDetails(payment)}>
                                                    Payment Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={!payment.documents?.some(d => d.document_type === 'invoice')}
                                                    onClick={() => handlePrintDocument(payment, 'invoice')}
                                                >
                                                    Print Invoice
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={!payment.documents?.some(d => d.document_type === 'receipt')}
                                                    onClick={() => handlePrintDocument(payment, 'receipt')}
                                                >
                                                    Print Receipt
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/admin/payments/${payment.id}`);
                                            }}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Payment</DialogTitle>
                        <DialogDescription>
                            Create a new payment record. Issuer Name and Phone are required.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Form Fields - Same as before */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="department">Department</Label>
                                <Select
                                    value={formData.department_id}
                                    onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    list="categories"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="Select or type category"
                                />
                                <datalist id="categories">
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="title">Payment Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Office Rent 2024"
                                required
                            />
                        </div>

                        {/* Issuer Details */}
                        <div className="grid grid-cols-2 gap-4 mt-2 p-3 border rounded-md bg-muted/20">
                            <div className="col-span-2 text-sm font-semibold text-muted-foreground mb-1">Issuer Details</div>
                            <div className="space-y-2">
                                <Label htmlFor="issuer_name">Issuer Name *</Label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="issuer_name"
                                        className="pl-9"
                                        value={formData.issuer_name}
                                        onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                                        placeholder="Company or Person Name"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="issuer_phone">Issuer Phone *</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="issuer_phone"
                                        className="pl-9"
                                        value={formData.issuer_phone_number}
                                        onChange={(e) => setFormData({ ...formData, issuer_phone_number: e.target.value })}
                                        placeholder="+234..."
                                        required
                                    />
                                </div>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="issuer_address">Issuer Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="issuer_address"
                                        className="pl-9"
                                        value={formData.issuer_address}
                                        onChange={(e) => setFormData({ ...formData, issuer_address: e.target.value })}
                                        placeholder="Address (Optional)"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">₦</span>
                                    <Input
                                        id="amount"
                                        type="number"
                                        className="pl-8"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Payment Type</Label>
                                <Select
                                    value={formData.payment_type}
                                    onValueChange={(value: any) => setFormData({ ...formData, payment_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="one-time">One-time</SelectItem>
                                        <SelectItem value="recurring">Recurring</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.payment_type === 'recurring' ? (
                                <div className="space-y-2">
                                    <Label htmlFor="period">Recurrence Period</Label>
                                    <Select
                                        value={formData.recurrence_period}
                                        onValueChange={(value) => setFormData({ ...formData, recurrence_period: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="payment_date">Payment Date</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="payment_date"
                                            type="date"
                                            className="pl-9"
                                            value={formData.payment_date}
                                            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {formData.payment_type === 'recurring' && (
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Next Payment Due</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="start_date"
                                        type="date"
                                        className="pl-9"
                                        value={formData.next_payment_due}
                                        onChange={(e) => setFormData({ ...formData, next_payment_due: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Additional details..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Payment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
