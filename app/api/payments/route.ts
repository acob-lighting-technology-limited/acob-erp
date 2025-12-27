import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Helper function to create Supabase client
function createClient() {
    const cookieStore = cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

// GET /api/payments - Get payments (filtered by department if not admin)
export async function GET(request: Request) {
    try {
        const supabase = createClient();
        const { searchParams } = new URL(request.url);

        const departmentId = searchParams.get('department_id');
        const paymentType = searchParams.get('payment_type');
        const category = searchParams.get('category');
        const status = searchParams.get('status');

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, department')
            .eq('id', user.id)
            .single();

        let query = supabase
            .from('department_payments')
            .select(`
                *,
                department:departments(*),
                documents:payment_documents(id, document_type, file_path, file_name)
            `)
            .order('created_at', { ascending: false });

        // If not admin, filter by user's department
        if (!profile?.is_admin) {
            const { data: userDept } = await supabase
                .from('departments')
                .select('id')
                .eq('name', profile?.department)
                .single();

            if (userDept) {
                query = query.eq('department_id', userDept.id);
            }
        } else if (departmentId) {
            // Admin can filter by specific department
            query = query.eq('department_id', departmentId);
        }

        // Apply filters
        if (paymentType) {
            query = query.eq('payment_type', paymentType);
        }
        if (category) {
            query = query.eq('category', category);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: payments, error } = await query;

        if (error) throw error;

        return NextResponse.json({ data: payments });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payments' },
            { status: 500 }
        );
    }
}

// POST /api/payments - Create a new payment
export async function POST(request: Request) {
    try {
        const supabase = createClient();

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            department_id,
            payment_type,
            category,
            title,
            description,
            amount,
            currency = 'NGN',
            recurrence_period,
            next_payment_due,
            payment_date,
            issuer_name,
            issuer_phone_number,
            issuer_address,
            payment_reference,
            notes,
        } = body;

        // Validate required fields
        if (!department_id || !payment_type || !category || !title || !amount || !issuer_name || !issuer_phone_number) {
            return NextResponse.json(
                { error: 'Missing required fields (including Issuer Name & Phone)' },
                { status: 400 }
            );
        }

        // Validate payment type specific fields
        if (payment_type === 'recurring' && (!recurrence_period || !next_payment_due)) {
            return NextResponse.json(
                { error: 'Recurring payments require recurrence_period and next_payment_due' },
                { status: 400 }
            );
        }

        if (payment_type === 'one-time' && !payment_date) {
            return NextResponse.json(
                { error: 'One-time payments require payment_date' },
                { status: 400 }
            );
        }

        // Auto-create category if it doesn't exist
        if (category) {
            try {
                await supabase
                    .from('payment_categories')
                    .insert({ name: category })
                    .select()
                    .single();
            } catch (error) {
                // Ignore error - category might already exist due to unique constraint
            }
        }

        // Check if user can create payment in this department
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, department')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            // Non-admin can only create in their own department
            const { data: userDept } = await supabase
                .from('departments')
                .select('id')
                .eq('name', profile?.department)
                .single();

            if (!userDept || userDept.id !== department_id) {
                return NextResponse.json(
                    { error: 'You can only create payments in your own department' },
                    { status: 403 }
                );
            }
        }

        // Create payment
        const { data: payment, error } = await supabase
            .from('department_payments')
            .insert({
                department_id,
                payment_type,
                category,
                title,
                description,
                amount,
                currency,
                recurrence_period: payment_type === 'recurring' ? recurrence_period : null,
                next_payment_due: payment_type === 'recurring' ? next_payment_due : null,
                payment_date: payment_type === 'one-time' ? payment_date : null,
                issuer_name,
                issuer_phone_number,
                issuer_address,
                payment_reference,
                notes,
                created_by: user.id,
            })
            .select(`
                *,
                department:departments(*)
            `)
            .single();

        if (error) throw error;

        return NextResponse.json({ data: payment }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating payment:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to create payment' },
            { status: 500 }
        );
    }
}
