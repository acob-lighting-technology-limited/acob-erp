# PMS Demo Walkthrough — April 7, 2026

## Quick Start

```bash
# Run the automated test (proves everything works):
npx tsx scripts/pms-e2e-test.ts
```

---

## Test Data Already Seeded

The following data is LIVE in production, ready for your demo:

| Entity | Count | Details |
|--------|-------|---------|
| Review Cycle | 1 | Q2 2026 (Apr 1 - Jun 30), status: active |
| Goals | 6 | 3 for Abdulsamad (high/medium/low), 3 for Chibuikem |
| Tasks | 11 | Individual, department, project, action items |
| Help Desk | 5 | 3 resolved/closed, 1 in-progress, 1 new |
| Attendance | 10 | 5 records each for Abdulsamad & Chibuikem |
| Leave | 1 | Abdulsamad: Apr 4 approved annual leave |
| Reviews | 2 | Behaviour scores: Abdulsamad=72, Chibuikem=85 |
| Project | 1 | ERP Phase 2 Deployment |

---

## Demo Script (Step by Step)

### ACT 1: Show the Data Inputs (5 min)

**Login as: Chibuikem (IT Lead)**

1. **Tasks Page** (`/tasks`)
   - Show 11 tasks for IT and Communications
   - Point out: individual tasks, department tasks, project tasks, action items
   - Show task T3 "Document all IT asset serial numbers" — department-wide, Abdulsamad completed his part individually

2. **Goals Page** (`/admin/hr/performance` → Goals tab)
   - Show Abdulsamad's 3 goals: Network (high), Support (medium), Operational (low, system-generated)
   - Show Chibuikem's 3 goals: ERP (high), Leadership (medium), Project Delivery (high)
   - Explain: priorities affect weight — high goals count 3× more than low goals

3. **Help Desk** (`/help-desk`)
   - Show 5 tickets serviced by IT and Communications
   - 3 resolved/closed = 60% resolution rate

4. **Attendance** (`/admin/hr/attendance`)
   - Show Abdulsamad's records: present, present, late, absent (on leave), wfh
   - Show the approved leave on Apr 4

5. **Leave** (`/admin/hr/leave`)
   - Show Abdulsamad's approved annual leave for Apr 4
   - Explain: this day is EXCLUDED from attendance scoring — he's not penalised

---

### ACT 2: Individual PMS Score (5 min)

**Open browser console or use the API directly:**

```
GET /api/hr/performance/score?user_id=3791c0f4-dde9-41f8-a227-986273532d9c&cycle_id=aaaaaaaa-0001-4000-a000-000000000001
```

**Abdulsamad Danmusa — Final Score: 68.45/100**

| Component | Weight | Score | Explanation |
|-----------|--------|-------|-------------|
| KPI Achievement | 70% | 75.00 | Weighted avg of 3 goals |
| CBT (Learning) | 10% | 0.00 | Not yet implemented |
| Attendance | 10% | 87.50 | 3.5/4 days (leave excluded) |
| Behaviour | 10% | 72.00 | Manager evaluation |

**KPI Breakdown:**
| Goal | Priority | Weight | Tasks | Completed | KPI% |
|------|----------|--------|-------|-----------|------|
| Network Infrastructure | High | 3× | 2 | 1 | 50% |
| IT Support Resolution | Medium | 2× | 2 | 2 | 100% |
| Operational Execution | Low | 1× | 1 | 1 | 100% |

**Weighted KPI = (50×3 + 100×2 + 100×1) / (3+2+1) = 450/6 = 75.00**

**Key talking points:**
- Abdulsamad completed a **department-assigned task** individually → got individual credit (Fix 1)
- His **approved leave** on Apr 4 was excluded from attendance denominator (Fix 2)
- His system-generated "Operational Execution" goal auto-captured the HCS compliance task

---

**Chibuikem Ilonze — Final Score: 60.07/100**

```
GET /api/hr/performance/score?user_id=1aeae0c5-ef2f-4790-be14-d0e696be01af&cycle_id=aaaaaaaa-0001-4000-a000-000000000001
```

| Component | Weight | Score | Explanation |
|-----------|--------|-------|-------------|
| KPI Achievement | 70% | 59.38 | Lower due to in-progress project tasks |
| CBT (Learning) | 10% | 0.00 | Not yet implemented |
| Attendance | 10% | 100.00 | Perfect attendance |
| Behaviour | 10% | 85.00 | Strong leadership evaluation |

---

### ACT 3: Department PMS Score (3 min)

```
GET /api/hr/performance/department-score?department=IT%20and%20Communications&cycle_id=aaaaaaaa-0001-4000-a000-000000000001
```

**IT and Communications — Department PMS: 60.77/100**

| Component | Weight | Score |
|-----------|--------|-------|
| Department KPI | 70% | 62.21 |
| Learning Capability | 10% | 0.00 |
| Attendance Compliance | 10% | 93.75 |
| Behaviour Leadership | 10% | 78.50 |

**Department KPI Breakdown:**
| Sub-component | Weight | Score |
|---------------|--------|-------|
| Avg Individual KPI | 40% | 67.19 |
| Action Items | 20% | 66.67 |
| Help Desk Resolution | 20% | 60.00 |
| Task/Project Delivery | 20% | 50.00 |

---

### ACT 4: What Makes This System Robust (2 min)

Tell management these features exist and are tested:

1. **Priority weighting** — high-priority goals count 3× more than low-priority
2. **No double counting** — action items, help desk, and task delivery are scored in separate buckets
3. **Leave-aware attendance** — approved leave doesn't penalise employees
4. **Individual credit for dept tasks** — when a dept task is assigned, each person gets credit for completing their part
5. **Department transfer safe** — if someone moves departments mid-cycle, their work stays with the old department's score
6. **Goal approval workflow** — only approved goals count toward KPI
7. **Score ceiling** — no component can exceed 100%
8. **System-generated goals** — if no matching goal exists, the system creates a fallback bucket automatically
9. **Balanced Scorecard** — 4 perspectives: KPI (process), CBT (learning), Attendance (compliance), Behaviour (people)

---

### ACT 5: Known Gaps to Discuss with Management

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| CBT = 0 | 10% of PMS is dead weight | Build CBT test system or redistribute weight |
| No 360 feedback | Behaviour is manager-only | Add peer/subordinate evaluations |
| No calibration | Departments scored independently | Add cross-department normalisation |
| No bell curve | Everyone could score 100% | Consider forced distribution |
| No custom goal weights | All goals within same priority tier are equal | Allow percentage allocation per goal |

---

## API Endpoints for Demo

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hr/performance/score?user_id=X&cycle_id=Y` | GET | Individual PMS |
| `/api/hr/performance/department-score?department=X&cycle_id=Y` | GET | Department PMS |
| `/api/hr/performance/goals?user_id=X&cycle_id=Y` | GET | View goals |
| `/api/hr/performance/reviews?cycle_id=Y` | GET | View reviews |
| `/api/hr/performance/cycles` | GET | List review cycles |

---

## Test Accounts

| Person | Role | Department | Login |
|--------|------|------------|-------|
| Chibuikem Ilonze | IT Lead | IT and Communications | Your main account |
| Abdulsamad Danmusa | Employee | IT and Communications | Employee account |
| Peter Ayoola | HCS (super_admin) | Corporate Services | HCS account |
| Alexander Obiechina | MD (super_admin) | Executive Management | MD account |

---

## If Something Breaks During Demo

```bash
# Re-run the test to verify the engine:
npx tsx scripts/pms-e2e-test.ts

# Check the API directly (replace with actual values):
curl "https://your-app.vercel.app/api/hr/performance/score?user_id=3791c0f4-dde9-41f8-a227-986273532d9c&cycle_id=aaaaaaaa-0001-4000-a000-000000000001"
```
