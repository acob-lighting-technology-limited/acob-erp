'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Department {
    id: string;
    name: string;
    description?: string;
    department_head_id?: string;
    is_active: boolean;
    created_at: string;
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/departments');
            if (response.ok) {
                const data = await response.json();
                setDepartments(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
            toast.error('Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (department?: Department) => {
        if (department) {
            setEditingDepartment(department);
            setFormData({
                name: department.name,
                description: department.description || '',
            });
        } else {
            setEditingDepartment(null);
            setFormData({ name: '', description: '' });
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingDepartment(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Department name is required');
            return;
        }

        try {
            const url = editingDepartment
                ? `/api/departments/${editingDepartment.id}`
                : '/api/departments';
            const method = editingDepartment ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                toast.success(
                    editingDepartment
                        ? 'Department updated successfully'
                        : 'Department created successfully'
                );
                handleCloseDialog();
                fetchDepartments();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to save department');
            }
        } catch (error) {
            console.error('Error saving department:', error);
            toast.error('Failed to save department');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this department?')) {
            return;
        }

        try {
            const response = await fetch(`/api/departments/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Department deleted successfully');
                fetchDepartments();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete department');
            }
        } catch (error) {
            console.error('Error deleting department:', error);
            toast.error('Failed to delete department');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="text-muted-foreground">Loading departments...</p>
                </div>
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
                        <div className="flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                                Department Management
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Manage departments for payment organization
                        </p>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Department
                    </Button>
                </div>

                {/* Departments List */}
                <Card>
                    <CardHeader>
                        <CardTitle>All Departments ({departments.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {departments.length === 0 ? (
                            <div className="py-12 text-center">
                                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-muted-foreground">
                                    No departments found. Add your first department to get started.
                                </p>
                                <div className="mt-4">
                                    <Button onClick={() => handleOpenDialog()}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Department
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {departments.map((department) => (
                                    <div
                                        key={department.id}
                                        className="flex items-center justify-between rounded-lg border p-4 transition-all hover:shadow-md"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-foreground">
                                                    {department.name}
                                                </h3>
                                                <Badge
                                                    variant={
                                                        department.is_active
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {department.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            {department.description && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {department.description}
                                                </p>
                                            )}
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Created:{' '}
                                                {new Date(
                                                    department.created_at
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenDialog(department)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDelete(department.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingDepartment ? 'Edit Department' : 'Add New Department'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingDepartment
                                ? 'Update the department information below.'
                                : 'Create a new department for organizing payments.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Department Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Engineering, Marketing"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Optional description of the department"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseDialog}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingDepartment ? 'Update' : 'Create'} Department
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
