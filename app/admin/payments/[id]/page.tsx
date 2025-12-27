'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    ArrowLeft,
    Calendar,
    CreditCard,
    DollarSign,
    FileText,
    MoreVertical,
    Trash2,
    CheckCircle,
    Clock,
    AlertCircle,
    Upload,
    Receipt,
    Edit,
    Building2,
    Phone,
    MapPin,
    Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    addMonths,
    addYears,
    addQuarters,
    format,
    parseISO,
    isBefore,
    isSameDay,
    differenceInDays,
    startOfDay,
    isValid
} from 'date-fns';

interface Department {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
    type: 'credit' | 'debit';
}

interface PaymentDocument {
    id: string;
    document_type: 'invoice' | 'receipt' | 'other';
    file_name: string;
    file_path: string;
    applicable_date: string | null;
    created_at: string;
}

interface Payment {
    id: string;
    department_id: string;
    payment_type: 'one-time' | 'recurring';
    category: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    recurrence_period?: 'monthly' | 'quarterly' | 'yearly';
    next_payment_due?: string;
    payment_date?: string;
    created_at: string;
    // invoice_number removed
    issuer_name?: string;
    issuer_phone_number?: string;
    issuer_address?: string;
    payment_reference?: string;
    amount_paid?: number;
    notes?: string;
    department?: {
        name: string;
    };
    documents?: PaymentDocument[];
}

interface ScheduleItem {
    date: Date;
    status: 'paid' | 'due' | 'upcoming' | 'overdue';
    label: string;
    documents: PaymentDocument[];
}

interface FormData {
    department_id: string;
    payment_type: 'one-time' | 'recurring';
    category: string;
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
}

const ScheduleList = ({ items, onUpload, onView, onMarkPaid }: {
    items: ScheduleItem[],
    onUpload: (d: Date, t: 'invoice' | 'receipt') => void,
    onView: (e: React.MouseEvent, doc: PaymentDocument) => void,
    onMarkPaid?: (d: Date) => void
}) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">No items found.</p>;

    return (
        <div className="rounded-md border divide-y">
            {items.map((item, index) => {
                const invoiceDoc = item.documents.find(d => d.document_type === 'invoice');
                const receiptDoc = item.documents.find(d => d.document_type === 'receipt');

                return (
                    <div key={index} className={cn("flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3", item.status === 'overdue' && "bg-red-50 dark:bg-red-950/20")}>
                        <div className="flex items-start gap-3">
                            <div className={cn("p-2 rounded-full",
                                item.status === 'paid' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                                    item.status === 'overdue' ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                                        item.status === 'due' ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30" :
                                            "bg-gray-100 text-gray-600 dark:bg-gray-800"
                            )}>
                                {item.status === 'paid' ? <CheckCircle className="w-4 h-4" /> :
                                    item.status === 'overdue' ? <AlertCircle className="w-4 h-4" /> :
                                        <Clock className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium">{format(item.date, 'PPP')}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs font-normal">
                                        {item.label}
                                    </Badge>
                                    {receiptDoc && (
                                        <span className="text-xs text-green-600 flex items-center gap-0.5">
                                            <Receipt className="w-3 h-3" /> Rec
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center ml-10 sm:ml-0">
                            {invoiceDoc ? (
                                <a
                                    href="#"
                                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs flex items-center gap-1 text-blue-600")}
                                    onClick={(e) => onView(e, invoiceDoc)}
                                >
                                    <CheckCircle className="w-3 h-3" /> Invoice
                                </a>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-dashed"
                                    onClick={() => onUpload(item.date, 'invoice')}
                                >
                                    <Upload className="w-3 h-3 mr-1" /> Invoice
                                </Button>
                            )}

                            {(item.status === 'paid' || item.status === 'overdue') && (
                                receiptDoc ? (
                                    <a
                                        href="#"
                                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs flex items-center gap-1 text-green-600")}
                                        onClick={(e) => onView(e, receiptDoc)}
                                    >
                                        <CheckCircle className="w-3 h-3" /> Receipt
                                    </a>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn("h-7 text-xs border-dashed", item.status === 'overdue' && "border-red-300 hover:bg-red-50 text-red-600")}
                                        onClick={() => onUpload(item.date, 'receipt')}
                                    >
                                        <Upload className="w-3 h-3 mr-1" /> Receipt
                                    </Button>
                                )
                            )}

                            {/* Mark Paid Button Action */}
                            {item.status === 'overdue' && onMarkPaid && (
                                <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => onMarkPaid(item.date)}
                                >
                                    Mark Paid
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default function PaymentDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);

    // Aux Data for Edit Form
    const [departments, setDepartments] = useState<Department[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

    // Upload State
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadDate, setUploadDate] = useState<Date | null>(null);
    const [uploadType, setUploadType] = useState<'invoice' | 'receipt'>('invoice');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editFormData, setEditFormData] = useState<FormData>({
        department_id: '',
        payment_type: 'one-time',
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
    });

    useEffect(() => {
        fetchPayment();
        fetchAuxData();
    }, [params.id]);

    useEffect(() => {
        if (payment && payment.payment_type === 'recurring' && payment.next_payment_due && payment.recurrence_period) {
            generateSchedule();
        }
    }, [payment]);

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
            console.error('Error fetching aux data', error);
        }
    };

    const fetchPayment = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/payments/${params.id}`);
            if (response.ok) {
                const data = await response.json();
                setPayment(data.data);
            } else {
                toast.error('Failed to fetch payment details');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error fetching payment');
        } finally {
            setLoading(false);
        }
    };

    const generateSchedule = () => {
        if (!payment || !payment.next_payment_due || !payment.recurrence_period) return;

        const nextDue = parseISO(payment.next_payment_due);

        // Use earliest of payment_date, created_at, or any document date
        let startDate = parseISO(payment.created_at);
        const paymentDate = payment.payment_date ? parseISO(payment.payment_date) : null;

        if (paymentDate && isBefore(paymentDate, startDate)) {
            startDate = paymentDate;
        }

        // Check documents for earlier dates
        if (payment.documents?.length) {
            payment.documents.forEach(doc => {
                // applicable_date is string YYYY-MM-DD
                // parseISO handles YYYY-MM-DD correctly (local time)
                const docDate = parseISO(doc.applicable_date);
                if (isBefore(docDate, startDate)) {
                    startDate = docDate;
                }
            });
        }

        const today = startOfDay(new Date());

        const items: ScheduleItem[] = [];

        const addPeriod = (date: Date, count: number) => {
            switch (payment.recurrence_period) {
                case 'monthly': return addMonths(date, count);
                case 'quarterly': return addQuarters(date, count);
                case 'yearly': return addYears(date, count);
                default: return addMonths(date, count);
            }
        };

        const getDocsForDate = (date: Date) => {
            if (!payment.documents) return [];
            const dateStr = format(date, 'yyyy-MM-dd');
            return payment.documents.filter(d => d.applicable_date === dateStr);
        };

        let lookbackCount = 1;
        while (lookbackCount <= 12) {
            const pastDate = addPeriod(nextDue, -lookbackCount);
            if (isBefore(pastDate, startDate) && !isSameDay(pastDate, startDate)) break;

            items.unshift({
                date: pastDate,
                status: 'paid',
                label: 'Completed',
                documents: getDocsForDate(pastDate)
            });
            lookbackCount++;
        }

        for (let i = 0; i < 6; i++) {
            const date = addPeriod(nextDue, i);
            const daysDiff = differenceInDays(date, today);

            let status: 'due' | 'overdue' | 'upcoming' | 'paid' = 'upcoming';
            let label = 'Scheduled';

            if (isBefore(date, today)) {
                status = 'overdue';
                label = 'Overdue';
            } else if (daysDiff <= 7) {
                status = 'due';
                label = 'Due Soon';
            } else {
                status = 'upcoming';
                label = 'Upcoming';
            }

            if (status === 'upcoming') {
                const isFirstUpcoming = !items.some(item => item.status === 'upcoming' || item.status === 'due');
                if (isFirstUpcoming && label !== 'Due Soon') {
                    label = 'Upcoming';
                } else {
                    label = 'Scheduled';
                }
            }

            items.push({
                date,
                status,
                label,
                documents: getDocsForDate(date)
            });
        }

        setSchedule(items);
    };

    const handleViewDocument = async (e: React.MouseEvent, doc?: PaymentDocument) => {
        e.preventDefault();
        if (!doc) return;

        try {
            const supabase = createClient();
            const { data, error } = await supabase.storage.from('payment_documents').createSignedUrl(doc.file_path, 3600);
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            } else {
                toast.error('Could not get secure document URL');
                if (error) console.error('Error signing URL:', error);
            }
        } catch (error) {
            toast.error('Error opening document');
        }
    };

    const handleEditClick = () => {
        if (!payment) return;
        setEditFormData({
            department_id: payment.department_id,
            payment_type: payment.payment_type,
            category: payment.category,
            title: payment.title,
            description: payment.description || '',
            amount: payment.amount.toString(),
            currency: payment.currency,
            recurrence_period: payment.recurrence_period || 'monthly',
            next_payment_due: payment.next_payment_due ? format(parseISO(payment.next_payment_due), 'yyyy-MM-dd') : '',
            payment_date: payment.payment_date ? format(parseISO(payment.payment_date), 'yyyy-MM-dd') : '',
            issuer_name: payment.issuer_name || '',
            issuer_phone_number: payment.issuer_phone_number || '',
            issuer_address: payment.issuer_address || '',
            payment_reference: payment.payment_reference || '',
            notes: payment.notes || '',
        });
        setEditDialogOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editFormData.issuer_name || !editFormData.issuer_phone_number) {
            toast.error("Issuer Name and Phone are required.");
            return;
        }

        try {
            setUpdating(true);
            const payload = {
                ...editFormData,
                amount: parseFloat(editFormData.amount),
                next_payment_due: editFormData.next_payment_due || null,
                payment_date: editFormData.payment_date || null,
            };

            const response = await fetch(`/api/payments/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                toast.success('Payment updated successfully');
                setEditDialogOpen(false);
                fetchPayment();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to update payment');
            }
        } catch (error) {
            toast.error('Error updating payment');
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = async () => {
        try {
            setDeleteLoading(true);
            const response = await fetch(`/api/payments/${params.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Payment deleted successfully');
                router.push('/admin/payments');
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to delete payment');
            }
        } catch (error) {
            toast.error('Error deleting payment');
        } finally {
            setDeleteLoading(false);
            setDeleteDialogOpen(false);
        }
    };

    const markAsPaid = async (targetDate?: Date | any) => {
        if (!payment) return;

        const dateToPay = (targetDate instanceof Date) ? targetDate : parseISO(payment.next_payment_due!);

        if (payment.payment_type === 'recurring' && payment.next_payment_due && payment.recurrence_period) {
            const dateStr = format(dateToPay, 'yyyy-MM-dd');
            const hasReceipt = payment.documents?.some(
                d => d.applicable_date === dateStr && d.document_type === 'receipt'
            );

            if (!hasReceipt) {
                toast.error('Please upload a payment receipt first.', {
                    action: {
                        label: 'Upload',
                        onClick: () => handleUploadClick(dateToPay, 'receipt')
                    },
                    duration: 5000
                });
                handleUploadClick(dateToPay, 'receipt');
                return;
            }

            const currentDue = parseISO(payment.next_payment_due);
            let nextDue: Date;
            switch (payment.recurrence_period) {
                case 'monthly': nextDue = addMonths(currentDue, 1); break;
                case 'quarterly': nextDue = addQuarters(currentDue, 1); break;
                case 'yearly': nextDue = addYears(currentDue, 1); break;
                default: nextDue = addMonths(currentDue, 1);
            }

            try {
                const response = await fetch(`/api/payments/${params.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        next_payment_due: format(nextDue, 'yyyy-MM-dd'),
                        last_payment_date: format(dateToPay, 'yyyy-MM-dd'),
                        status: 'pending',
                        amount_paid: (payment.amount_paid || 0) + payment.amount
                    }),
                });

                if (response.ok) {
                    toast.success('Payment recorded! Schedule advanced.');
                    fetchPayment();
                } else {
                    toast.error('Failed to update payment');
                }
            } catch (error) {
                toast.error('Error processing payment');
            }
        } else {
            updateStatus('paid');
        }
    };

    const updateStatus = async (newStatus: string) => {
        try {
            const response = await fetch(`/api/payments/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    amount_paid: newStatus === 'paid' ? payment.amount : (newStatus === 'pending' ? 0 : payment.amount_paid)
                }),
            });

            if (response.ok) {
                toast.success(`Payment marked as ${newStatus}`);
                fetchPayment();
            } else {
                toast.error('Failed to update status');
            }
        } catch (error) {
            toast.error('Error updating status');
        }
    };

    const handleUploadClick = (date: Date, type: 'invoice' | 'receipt') => {
        setUploadDate(date);
        setUploadType(type);
        setUploadDialogOpen(true);
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileInputRef.current?.files?.[0] || !uploadDate) return;

        const file = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', uploadType);
        formData.append('applicable_date', format(uploadDate, 'yyyy-MM-dd'));

        setUploading(true);
        try {
            const response = await fetch(`/api/payments/${params.id}/documents`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                toast.success(`${uploadType} uploaded successfully`);
                setUploadDialogOpen(false);
                fetchPayment(); // Refresh to show new doc
            } else {
                const data = await response.json();
                toast.error(data.error || 'Upload failed');
            }
        } catch (error) {
            toast.error('Error uploading file');
        } finally {
            setUploading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'pending':
            case 'due': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'upcoming': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800';
            case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
            default: return '';
        }
    };

    const formatCurrency = (amount: number, currency: string = 'NGN') => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="text-muted-foreground">Loading payment details...</p>
                </div>
            </div>
        );
    }

    if (!payment) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">Payment not found</p>
                <Link href="/admin/payments">
                    <Button variant="outline">Back to Payments</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/admin/payments"
                            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Payments
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                                {payment.title}
                            </h1>
                            <Badge className={getStatusColor(payment.status === 'pending' && payment.payment_type === 'recurring' ? 'due' : payment.status)}>
                                {payment.status}
                            </Badge>
                            {/* Highlight Next Due Date */}
                            {payment.payment_type === 'recurring' && payment.next_payment_due && (
                                <Badge variant="outline" className="text-sm border-2 border-primary/20 text-primary font-medium py-0.5 px-2 bg-primary/5">
                                    Next Due: {format(parseISO(payment.next_payment_due), 'MMM d, yyyy')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {payment.payment_type === 'recurring'
                                ? `Repeats ${payment.recurrence_period}`
                                : `One-time payment on ${payment.payment_date ? format(parseISO(payment.payment_date), 'PPP') : 'N/A'}`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {(payment.status === 'pending' || payment.status === 'overdue') && (
                            <Button onClick={(e) => markAsPaid(e)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {payment.payment_type === 'recurring' ? 'Mark Current Due as Paid' : 'Mark as Paid'}
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleEditClick}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPrintDialogOpen(true)}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Receipt
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Payment
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-6 md:col-span-2">
                        {/* Recurrence Schedule */}
                        {payment.payment_type === 'recurring' && (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5" />
                                            Upcoming Schedule
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ScheduleList
                                            items={schedule.filter(i => i.status !== 'paid')}
                                            onUpload={handleUploadClick}
                                            onView={handleViewDocument}
                                            onMarkPaid={markAsPaid}
                                        />
                                    </CardContent>
                                </Card>

                                {schedule.some(i => i.status === 'paid') && (
                                    <Card className="mt-6">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <FileText className="w-5 h-5" />
                                                Payment History
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ScheduleList
                                                items={schedule.filter(i => i.status === 'paid')}
                                                onUpload={handleUploadClick}
                                                onView={handleViewDocument}
                                            />
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Amount</p>
                                        <p className="text-2xl font-bold">
                                            {formatCurrency(payment.amount, payment.currency)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Department</p>
                                        <p className="text-lg font-medium">{payment.department?.name || 'Unknown'}</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Category</p>
                                        <Badge variant="outline">{payment.category}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                                        <span className="capitalize">{payment.payment_type}</span>
                                    </div>
                                </div>
                                {payment.description && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Description</p>
                                        <p className="mt-1 text-sm">{payment.description}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Meta Info</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Issuer Info */}
                                    <div className="space-y-3 pb-4 border-b">
                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                            Issuer Details
                                        </h4>
                                        <dl className="space-y-2 text-sm">
                                            <div>
                                                <dt className="text-muted-foreground text-xs">Name</dt>
                                                <dd className="font-medium">{payment.issuer_name || 'N/A'}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-muted-foreground text-xs">Phone</dt>
                                                <dd className="font-medium">{payment.issuer_phone_number || 'N/A'}</dd>
                                            </div>
                                            {payment.issuer_address && (
                                                <div>
                                                    <dt className="text-muted-foreground text-xs">Address</dt>
                                                    <dd className="text-muted-foreground">{payment.issuer_address}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    <dl className="grid gap-4">
                                        {/* Removed invoice_number */}
                                        {payment.payment_reference && (
                                            <div>
                                                <dt className="text-sm font-medium text-muted-foreground">Reference</dt>
                                                <dd className="text-sm break-all">{payment.payment_reference}</dd>
                                            </div>
                                        )}
                                    </dl>
                                    <div className="flex gap-4 border-t pt-4">
                                        <div className="pt-0.5 pb-8">
                                            <p className="text-sm font-medium text-foreground">Created</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(parseISO(payment.created_at), 'PPP')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Payment</DialogTitle>
                        <DialogDescription>
                            Update the payment details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="department">Department</Label>
                                <Select
                                    value={editFormData.department_id}
                                    onValueChange={(value) => setEditFormData({ ...editFormData, department_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
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
                                <Label htmlFor="payment_type">Payment Type</Label>
                                <Select
                                    value={editFormData.payment_type}
                                    onValueChange={(value: 'one-time' | 'recurring') =>
                                        setEditFormData({ ...editFormData, payment_type: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="one-time">One-time Payment</SelectItem>
                                        <SelectItem value="recurring">Recurring Payment</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={editFormData.title}
                                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    list="categories"
                                    value={editFormData.category}
                                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                    placeholder="Select or type category"
                                />
                                <datalist id="categories">
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        {/* Issuer Fields */}
                        <div className="grid grid-cols-2 gap-4 mt-2 p-3 border rounded-md bg-muted/20">
                            <div className="col-span-2 text-sm font-semibold text-muted-foreground mb-1">Issuer Details</div>
                            <div className="space-y-2">
                                <Label htmlFor="issuer_name">Issuer Name *</Label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="issuer_name"
                                        className="pl-9"
                                        value={editFormData.issuer_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, issuer_name: e.target.value })}
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
                                        value={editFormData.issuer_phone_number}
                                        onChange={(e) => setEditFormData({ ...editFormData, issuer_phone_number: e.target.value })}
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
                                        value={editFormData.issuer_address}
                                        onChange={(e) => setEditFormData({ ...editFormData, issuer_address: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="amount"
                                        type="number"
                                        className="pl-9"
                                        value={editFormData.amount}
                                        onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select
                                    value={editFormData.currency}
                                    onValueChange={(value) => setEditFormData({ ...editFormData, currency: value })}
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

                        {editFormData.payment_type === 'recurring' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recurrence">Recurrence Period</Label>
                                    <Select
                                        value={editFormData.recurrence_period}
                                        onValueChange={(value) => setEditFormData({ ...editFormData, recurrence_period: value })}
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
                                <div className="space-y-2">
                                    <Label htmlFor="next_due">Next Payment Due</Label>
                                    <Input
                                        id="next_due"
                                        type="date"
                                        value={editFormData.next_payment_due}
                                        onChange={(e) => setEditFormData({ ...editFormData, next_payment_due: e.target.value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="payment_date">Payment Date</Label>
                                <Input
                                    id="payment_date"
                                    type="date"
                                    value={editFormData.payment_date}
                                    onChange={(e) => setEditFormData({ ...editFormData, payment_date: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={editFormData.description}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updating}>
                                {updating ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the payment
                            record and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload {uploadType === 'invoice' ? 'Invoice' : 'Receipt'}</DialogTitle>
                        <DialogDescription>
                            Upload a document for the payment period of {uploadDate ? format(uploadDate, 'PPP') : ''}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFileUpload}>
                        <div className="grid w-full items-center gap-4 py-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="file">Document File</Label>
                                <Input id="file" type="file" ref={fileInputRef} required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Print Receipt Dialog */}
            <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Receipt to Print</DialogTitle>
                        <DialogDescription>
                            Choose a receipt from the list below to view and print.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                        {schedule.flatMap(item =>
                            item.documents.filter(d => d.document_type === 'receipt').map(doc => ({
                                doc,
                                date: item.date,
                                label: item.label
                            }))
                        ).length > 0 ? (
                            schedule.flatMap(item =>
                                item.documents.filter(d => d.document_type === 'receipt').map(doc => ({
                                    doc,
                                    date: item.date,
                                    label: item.label
                                }))
                            ).map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-full text-green-600">
                                            <Receipt className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Receipt for {format(item.date, 'MMM yyyy')}</p>
                                            <p className="text-xs text-muted-foreground">{format(item.date, 'PPP')}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={(e) => {
                                        setPrintDialogOpen(false);
                                        handleViewDocument(e, item.doc);
                                    }}>
                                        <Printer className="w-4 h-4 mr-1" />
                                        Open
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No receipts available to print.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
