// Starlink Payment Management Utilities

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays, parseISO } from 'date-fns';
import type { PaymentStatus } from '@/types/starlink';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Calculate days until payment is due
 */
export function calculateDaysUntilPayment(dueDate: string | Date): number {
    const due = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
    return differenceInDays(due, new Date());
}

/**
 * Get color coding for payment status
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
    const colors: Record<PaymentStatus, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    return colors[status];
}

/**
 * Get color coding based on days until payment
 */
export function getDaysUntilColor(daysUntil: number): string {
    if (daysUntil < 0) {
        return 'text-red-600 dark:text-red-400';
    } else if (daysUntil <= 3) {
        return 'text-orange-600 dark:text-orange-400';
    } else if (daysUntil <= 7) {
        return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-green-600 dark:text-green-400';
}

/**
 * Get urgency badge color based on days until payment
 */
export function getUrgencyBadgeColor(daysUntil: number): string {
    if (daysUntil < 0) {
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    } else if (daysUntil <= 3) {
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    } else if (daysUntil <= 7) {
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
}

/**
 * Get urgency text based on days until payment
 */
export function getUrgencyText(daysUntil: number): string {
    if (daysUntil < 0) {
        return 'Overdue';
    } else if (daysUntil === 0) {
        return 'Due Today';
    } else if (daysUntil === 1) {
        return 'Due Tomorrow';
    } else if (daysUntil <= 3) {
        return 'Urgent';
    } else if (daysUntil <= 7) {
        return 'Due Soon';
    }
    return 'Upcoming';
}

/**
 * Format payment period
 */
export function formatPaymentPeriod(start: string | Date, end: string | Date): string {
    const startDate = typeof start === 'string' ? parseISO(start) : start;
    const endDate = typeof end === 'string' ? parseISO(end) : end;

    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on mime type
 */
export function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    return '📎';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format (Nigerian)
 */
export function isValidPhoneNumber(phone: string): boolean {
    // Accepts formats: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX
    const phoneRegex = /^(\+?234|0)[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.startsWith('+234')) {
        return cleaned;
    } else if (cleaned.startsWith('234')) {
        return '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
        return '+234' + cleaned.substring(1);
    }
    return phone;
}

/**
 * Generate requisition reference number
 */
export function generateRequisitionReference(siteCode: string, invoiceNumber: string): string {
    const date = format(new Date(), 'yyyyMMdd');
    const shortInvoice = invoiceNumber.split('-').pop() || invoiceNumber.substring(0, 6);
    return `REQ-STL-${siteCode}-${shortInvoice}-${date}`;
}

/**
 * Parse billing period text from Starlink
 */
export function parseBillingPeriod(periodText: string): { start: Date; end: Date } | null {
    // Example: "Your billing period is December 3 - January 2."
    const match = periodText.match(/(\w+)\s+(\d+)\s*-\s*(\w+)\s+(\d+)/);

    if (!match) return null;

    const [, startMonth, startDay, endMonth, endDay] = match;
    const currentYear = new Date().getFullYear();

    const start = new Date(`${startMonth} ${startDay}, ${currentYear}`);
    let end = new Date(`${endMonth} ${endDay}, ${currentYear}`);

    // If end month is before start month, it's next year
    if (end < start) {
        end = new Date(`${endMonth} ${endDay}, ${currentYear + 1}`);
    }

    return { start, end };
}

/**
 * Extract site code from site name
 */
export function getSiteCode(siteName: string): string {
    return siteName.substring(0, 3).toUpperCase();
}

/**
 * Sort payments by urgency
 */
export function sortByUrgency<T extends { next_payment_due: string }>(payments: T[]): T[] {
    return [...payments].sort((a, b) => {
        const daysA = calculateDaysUntilPayment(a.next_payment_due);
        const daysB = calculateDaysUntilPayment(b.next_payment_due);
        return daysA - daysB;
    });
}

/**
 * Group payments by state
 */
export function groupPaymentsByState<T extends { state?: string }>(
    payments: T[]
): Record<string, T[]> {
    return payments.reduce(
        (acc, payment) => {
            const state = payment.state || 'Unknown';
            if (!acc[state]) {
                acc[state] = [];
            }
            acc[state].push(payment);
            return acc;
        },
        {} as Record<string, T[]>
    );
}
