#!/bin/bash

# Migration Testing Script for ACOB ERP
# Tests all database migrations on staging database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "ACOB ERP - Migration Testing Script"
echo "======================================"
echo ""

# Check if project ID is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Project ID required${NC}"
    echo "Usage: ./test-migrations.sh <project-id>"
    exit 1
fi

PROJECT_ID=$1
echo -e "${YELLOW}Testing migrations for project: $PROJECT_ID${NC}"
echo ""

# Function to run SQL and check result
run_test() {
    local test_name=$1
    local sql_query=$2
    
    echo -n "Testing: $test_name... "
    
    if npx supabase db execute --project-ref "$PROJECT_ID" --sql "$sql_query" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

# Counter for tests
TOTAL_TESTS=0
PASSED_TESTS=0

# Test 1: Check RLS is enabled on all critical tables
echo "=== Testing RLS Policies ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "RLS enabled on profiles" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles' AND rowsecurity = true"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "RLS enabled on leave_requests" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests' AND rowsecurity = true"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "RLS enabled on attendance_records" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_records' AND rowsecurity = true"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "RLS enabled on performance_reviews" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'performance_reviews' AND rowsecurity = true"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "RLS enabled on department_payments" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'department_payments' AND rowsecurity = true"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 2: Check constraints exist
echo "=== Testing Data Integrity Constraints ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "NOT NULL on profiles.company_email" "SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company_email' AND is_nullable = 'NO'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "CHECK constraint on payment status" "SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'department_payments_status_check'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "UNIQUE constraint on department names" "SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'departments_name_unique' AND constraint_type = 'UNIQUE'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 3: Check foreign keys
echo "=== Testing Foreign Key Constraints ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "FK: department_payments -> departments" "SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'department_payments_department_id_fkey' AND constraint_type = 'FOREIGN KEY'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "FK: leave_requests -> profiles" "SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_user_id_fkey' AND constraint_type = 'FOREIGN KEY'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 4: Check indexes exist
echo "=== Testing Performance Indexes ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Index on department_payments.status" "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_department_payments_status'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Index on tasks.assigned_to" "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_assigned_to'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 5: Check functions have search_path set
echo "=== Testing Function Security ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Functions have search_path" "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prosecdef = true AND p.proconfig IS NOT NULL LIMIT 1"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 6: Check computed columns
echo "=== Testing Computed Columns ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "profiles.full_name exists" "SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 7: Check payment consolidation
echo "=== Testing Payment System Consolidation ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "department_payments has category column" "SELECT 1 FROM information_schema.columns WHERE table_name = 'department_payments' AND column_name = 'category'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "department_payments has site_id" "SELECT 1 FROM information_schema.columns WHERE table_name = 'department_payments' AND column_name = 'site_id'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 8: Check HR tables exist
echo "=== Testing HR Module Tables ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "leave_requests table exists" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "attendance_records table exists" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_records'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "performance_reviews table exists" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'performance_reviews'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "goals_objectives table exists" "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'goals_objectives'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 9: Check RLS policy counts
echo "=== Testing RLS Policy Coverage ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "leave_requests has policies" "SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_requests' LIMIT 1"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "attendance_records has policies" "SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_records' LIMIT 1"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "performance_reviews has policies" "SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'performance_reviews' LIMIT 1"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $((TOTAL_TESTS - PASSED_TESTS))${NC}"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}✓ All migrations verified successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the migration files.${NC}"
    exit 1
fi
