import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

        if (!profile || !['super_admin', 'admin', 'staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all sites with their latest payment info
        const { data: sites, error } = await supabase
            .from('starlink_sites')
            .select(
                `
        *,
        starlink_payments (
          id,
          invoice_number,
          next_payment_due,
          payment_status,
          amount,
          currency
        )
      `
            )
            .eq('is_active', true)
            .order('site_name');

        if (error) {
            console.error('Error fetching starlink sites:', error);
            return NextResponse.json(
                { error: 'Failed to fetch sites' },
                { status: 500 }
            );
        }

        // Process sites to include latest payment and days until due
        const processedSites = sites?.map((site) => {
            const payments = site.starlink_payments || [];
            const latestPayment = payments
                .filter((p: any) => p.payment_status === 'pending')
                .sort(
                    (a: any, b: any) =>
                        new Date(a.next_payment_due).getTime() -
                        new Date(b.next_payment_due).getTime()
                )[0];

            let daysUntilDue = null;
            if (latestPayment) {
                const dueDate = new Date(latestPayment.next_payment_due);
                const today = new Date();
                daysUntilDue = Math.ceil(
                    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
            }

            return {
                ...site,
                latest_payment: latestPayment || null,
                payment_count: payments.length,
                next_payment_due: latestPayment?.next_payment_due || null,
                days_until_due: daysUntilDue,
                starlink_payments: undefined, // Remove the nested array
            };
        });

        return NextResponse.json({ data: processedSites });
    } catch (error) {
        console.error('Error in GET /api/starlink/sites:', error);
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

        // Check user role (only admins can create sites)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { state, site_name, email, phone_number, serial_number, notes } =
            body;

        // Validate required fields
        if (!state || !site_name || !email || !phone_number || !serial_number) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert new site
        const { data: newSite, error } = await supabase
            .from('starlink_sites')
            .insert({
                state,
                site_name,
                email,
                phone_number,
                serial_number,
                notes,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating starlink site:', error);
            return NextResponse.json(
                { error: 'Failed to create site', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: newSite, message: 'Site created successfully' });
    } catch (error) {
        console.error('Error in POST /api/starlink/sites:', error);
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
                { error: 'Site ID is required' },
                { status: 400 }
            );
        }

        // Update site
        const { data: updatedSite, error } = await supabase
            .from('starlink_sites')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating starlink site:', error);
            return NextResponse.json(
                { error: 'Failed to update site' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: updatedSite, message: 'Site updated successfully' });
    } catch (error) {
        console.error('Error in PUT /api/starlink/sites:', error);
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
                { error: 'Site ID is required' },
                { status: 400 }
            );
        }

        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('starlink_sites')
            .update({ is_active: false })
            .eq('id', id);

        if (error) {
            console.error('Error deleting starlink site:', error);
            return NextResponse.json(
                { error: 'Failed to delete site' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'Site deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/starlink/sites:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}
