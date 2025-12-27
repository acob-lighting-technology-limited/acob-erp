import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

        // Check user role (only admins can import)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { sites } = body;

        if (!sites || !Array.isArray(sites)) {
            return NextResponse.json(
                { error: 'Invalid data format. Expected array of sites.' },
                { status: 400 }
            );
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
        };

        // Process each site
        for (const siteData of sites) {
            try {
                // Parse billing period to get dates
                const billingPeriodMatch = siteData.billing_period?.match(
                    /(\w+)\s+(\d+)\s*-\s*(\w+)\s+(\d+)/
                );

                let billingStart, billingEnd, nextPaymentDue;

                if (billingPeriodMatch) {
                    const [, startMonth, startDay, endMonth, endDay] = billingPeriodMatch;
                    const currentYear = new Date().getFullYear();

                    billingStart = new Date(`${startMonth} ${startDay}, ${currentYear}`);
                    billingEnd = new Date(`${endMonth} ${endDay}, ${currentYear}`);

                    // If end month is before start month, it's next year
                    if (billingEnd < billingStart) {
                        billingEnd = new Date(`${endMonth} ${endDay}, ${currentYear + 1}`);
                    }

                    // Parse next payment due
                    const nextPaymentMatch = siteData.next_payment_due?.match(
                        /(\w+)\s+(\d+),\s+(\d+)/
                    );
                    if (nextPaymentMatch) {
                        const [, month, day, year] = nextPaymentMatch;
                        nextPaymentDue = new Date(`${month} ${day}, ${year}`);
                    }
                }

                // Check if site already exists
                const { data: existingSite } = await supabase
                    .from('starlink_sites')
                    .select('id')
                    .eq('serial_number', siteData.serial_number)
                    .single();

                let siteId;

                if (existingSite) {
                    // Update existing site
                    const { data: updatedSite, error: updateError } = await supabase
                        .from('starlink_sites')
                        .update({
                            state: siteData.state,
                            site_name: siteData.site_name,
                            email: siteData.email,
                            phone_number: siteData.phone_number,
                        })
                        .eq('id', existingSite.id)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    siteId = updatedSite.id;
                } else {
                    // Create new site
                    const { data: newSite, error: insertError } = await supabase
                        .from('starlink_sites')
                        .insert({
                            state: siteData.state,
                            site_name: siteData.site_name,
                            email: siteData.email,
                            phone_number: siteData.phone_number,
                            serial_number: siteData.serial_number,
                            created_by: user.id,
                        })
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    siteId = newSite.id;
                }

                // Create payment record if we have billing info
                if (billingStart && billingEnd && nextPaymentDue) {
                    // Check if payment already exists
                    const { data: existingPayment } = await supabase
                        .from('starlink_payments')
                        .select('id')
                        .eq('site_id', siteId)
                        .eq('invoice_number', siteData.invoice_number)
                        .single();

                    if (!existingPayment) {
                        const { error: paymentError } = await supabase
                            .from('starlink_payments')
                            .insert({
                                site_id: siteId,
                                invoice_number: siteData.invoice_number,
                                billing_period_start: billingStart.toISOString().split('T')[0],
                                billing_period_end: billingEnd.toISOString().split('T')[0],
                                next_payment_due: nextPaymentDue.toISOString().split('T')[0],
                                payment_status: 'pending',
                                created_by: user.id,
                            });

                        if (paymentError) throw paymentError;
                    }
                }

                results.success++;
            } catch (error: any) {
                results.failed++;
                results.errors.push(
                    `Failed to import ${siteData.site_name}: ${error.message}`
                );
                console.error(`Error importing site ${siteData.site_name}:`, error);
            }
        }

        return NextResponse.json({
            message: 'Import completed',
            results,
        });
    } catch (error) {
        console.error('Error in POST /api/starlink/import:', error);
        return NextResponse.json(
            { error: 'An error occurred during import' },
            { status: 500 }
        );
    }
}
