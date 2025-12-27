import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siteId = searchParams.get('site_id');
        const status = searchParams.get('status');
        const paymentId = searchParams.get('payment_id');

        let query = supabase
            .from('starlink_payments')
            .select(
                `
        *,
        site:starlink_sites (
          id,
          state,
          site_name,
          email,
          serial_number
        )
      `
            )
            .order('next_payment_due', { ascending: false });

        // Apply filters
        if (siteId) {
            query = query.eq('site_id', siteId);
        }

        if (status) {
            query = query.eq('payment_status', status);
        }

        if (paymentId) {
            query = query.eq('id', paymentId);
        }

        const { data: payments, error } = await query;

        if (error) {
            console.error('Error fetching starlink payments:', error);
            return NextResponse.json(
                { error: 'Failed to fetch payments' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: payments });
    } catch (error) {
        console.error('Error in GET /api/starlink/payments:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const {
            site_id,
            invoice_number,
            billing_period_start,
            billing_period_end,
            next_payment_due,
            amount,
            currency,
            payment_status,
            notes,
        } = body;

        // Validate required fields
        if (
            !site_id ||
            !invoice_number ||
            !billing_period_start ||
            !billing_period_end ||
            !next_payment_due
        ) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert new payment
        const { data: newPayment, error } = await supabase
            .from('starlink_payments')
            .insert({
                site_id,
                invoice_number,
                billing_period_start,
                billing_period_end,
                next_payment_due,
                amount,
                currency: currency || 'NGN',
                payment_status: payment_status || 'pending',
                notes,
                created_by: user.id,
            })
            .select(
                `
        *,
        site:starlink_sites (
          id,
          state,
          site_name,
          email
        )
      `
            )
            .single();

        if (error) {
            console.error('Error creating starlink payment:', error);
            return NextResponse.json(
                { error: 'Failed to create payment', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: newPayment,
            message: 'Payment created successfully',
        });
    } catch (error) {
        console.error('Error in POST /api/starlink/payments:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Payment ID is required' },
                { status: 400 }
            );
        }

        // If marking as paid, set payment_date
        if (updates.payment_status === 'paid' && !updates.payment_date) {
            updates.payment_date = new Date().toISOString().split('T')[0];
        }

        // Update payment
        const { data: updatedPayment, error } = await supabase
            .from('starlink_payments')
            .update(updates)
            .eq('id', id)
            .select(
                `
        *,
        site:starlink_sites (
          id,
          state,
          site_name,
          email
        )
      `
            )
            .single();

        if (error) {
            console.error('Error updating starlink payment:', error);
            return NextResponse.json(
                { error: 'Failed to update payment' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: updatedPayment,
            message: 'Payment updated successfully',
        });
    } catch (error) {
        console.error('Error in PUT /api/starlink/payments:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is authenticated
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user role (only super_admin can delete)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Payment ID is required' },
                { status: 400 }
            );
        }

        // Delete payment
        const { error } = await supabase
            .from('starlink_payments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting starlink payment:', error);
            return NextResponse.json(
                { error: 'Failed to delete payment' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/starlink/payments:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}
