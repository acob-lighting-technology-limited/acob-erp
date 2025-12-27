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

// GET /api/departments - Get all departments
export async function GET() {
    try {
        const supabase = createClient();

        const { data: departments, error } = await supabase
            .from('departments')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        return NextResponse.json({ data: departments });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch departments' },
            { status: 500 }
        );
    }
}

// POST /api/departments - Create a new department (admin only)
export async function POST(request: Request) {
    try {
        const supabase = createClient();

        // Check if user is admin
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, department_head_id } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Department name is required' },
                { status: 400 }
            );
        }

        const { data: department, error } = await supabase
            .from('departments')
            .insert({
                name,
                description,
                department_head_id,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data: department }, { status: 201 });
    } catch (error) {
        console.error('Error creating department:', error);
        return NextResponse.json(
            { error: 'Failed to create department' },
            { status: 500 }
        );
    }
}
