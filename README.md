# SchoolBook SMS (School Management System)

> **Next-Generation Cloud-Ready School Management & Student Information System (SMS / SIS)**  
> *Engineered for Modern Academies, K-12 Institutions, Colleges, and Multi-Campus Educational Networks.*

---

## 🌟 Executive Summary

**SchoolBook SMS** is an enterprise-grade, multi-tenant academic management platform designed to eliminate paper-based administrative friction and modernize institutional operations. Built with a high-performance TypeScript/Node.js backend and a reactive, zero-framework Vanilla TypeScript frontend, SchoolBook unifies student record-keeping, live roll-call attendance, departmental asset tracking, tuition billing, and institutional circular dispatching under a single pane of glass.

---

## 🚀 Key Architectural Highlights

* 🏢 **Logical Multi-Tenancy**: Host multiple independent schools or campus branches (e.g., *Oakridge International Academy* and *Maplewood Preparatory School*) on a single infrastructure instance with strict header-enforced tenant isolation (`x-tenant-id`).
* 🔐 **Role-Based Access Control (RBAC)**: Fine-grained security matrix catering to four distinct academic personas: **Principal**, **Teacher**, **Counselor**, and **Student**.
* ⏱️ **Automated Student Lifecycle & Inactivity Engine**: Built-in 30-day absence algorithm that automatically transitions chronically absent students to `Inactive` status while protecting administrative faculty.
* 📈 **Predictive Financial Projections**: Built-in algorithmic forecasting that models rolling weekly collection velocity and projects upcoming term revenue across tuition categories.
* ⚡ **Zero-Dependency Modern Frontend**: Powered by modular TypeScript, esbuild bundling (sub-20ms builds), and a bespoke, responsive CSS design system featuring curated typography, glassmorphism, and micro-interactions.

---

## 👥 Demo Personas & Pre-Seeded Campuses

SchoolBook comes pre-seeded with two full academic campuses and interactive demo profiles:

### 1. Oakridge International Academy (`tenant_oakridge`)
| Persona | Name | Role | Position | Access Rights |
| :--- | :--- | :--- | :--- | :--- |
| **Executive** | **Dr. Evelyn Vance** | `Principal` | Head of School | Super-admin access across all campus modules, ledgers, & circulars |
| **Instructor** | **Prof. Marcus Brody** | `Teacher` | Senior STEM Instructor | STEM curriculum delivery, laboratory mentorship, faculty circulars |
| **Instructor** | **Ms. Clara Higgins** | `Teacher` | Lead Teacher & Registrar | Class roll call marking, session closing, attendance sheets |
| **Student Welfare**| **Mr. David Miller** | `Counselor` | Guidance Counselor | Full student directory, attendance trends, freshmen support |
| **Scholar (Active)**| **Sophia Chen** | `Student` | Grade 10 - Class A | Self-service tuition payment portal, campus circulars |
| **Scholar (Defaulter)**| **Thomas Vance** | `Student` | Grade 10 - Class A | Demonstrates automatic `Inactive` tag due to 30+ days without attendance |

### 2. Maplewood Preparatory School (`tenant_maplewood`)
* Complete independent campus partition demonstrating isolated departmental rosters, distinct tuition ledgers, and independent asset registers.

---

## 🧩 Functional Modules

### 1. 📊 Executive Overview & KPI Dashboard
* Real-time metrics tracking total student body count, active faculty count, campus roll call attendance averages, active campus physical assets, and total collected term tuition.
* Historical attendance consistency charts and weekly collection volume analytics.

### 2. 🎓 Student & Faculty Directory
* Centralized directory supporting multi-attribute filtering (Active/Inactive, Faculty, Grade Cohort, Search Query).
* Comprehensive student profiles including Student ID, email, contact telephone, residential address, date of birth (month/day), faculty assignment, and enrollment timestamp.
* Role-protected **Enroll Student / Faculty Member** modal dialog.

### 3. 📋 Live Roll Call Attendance Register
* Class-specific roll call sheets with session filters (*Morning Roll Call*, *Period 1 - STEM Lecture*, *Homeroom Advisory*).
* Single-click **Present / Absent** toggle with visual status badges.
* **Close Roll Call Session**: Automatically marks all unmarked enrolled students as Absent and commits session metrics to the database.
* **Faculty Attendance Analytics**: Tracks attendance consistency across academic personnel.

### 4. 🔬 Campus Asset & Lab Inventory
* Asset health register across specialized departments (*STEM Science Labs*, *Athletics*, *Humanities*, *Music & Arts*).
* Real-time status toggling (`Active`, `Faulty`, `Unavailable`) with instant visual badge updates.
* Restricted asset decommissioning and additions limited to the Principal.

### 5. 💳 Tuition & Fees Gateway
* Multi-category billing ledger supporting:
  * **Tuition** (Term installments)
  * **Lab & Library Fees** (Science apparatus & digital access)
  * **PTA & Extracurricular** (Athletic gear, clubs, student council)
  * **Donations** (Alumni scholarships & endowment funds)
* End-to-end simulated payment gateway with credit card format validation, CVV verification, and transaction receipt generation.
* Automated 4-week collection trend analysis and predictive growth modeling.

### 6. 📢 School Circulars & Broadcast System
* Multicast institutional notification engine.
* Audience targeting:
  * **Campus-Wide**: Dispatched to all students and faculty (restricted to Principal).
  * **Faculty / Cohort**: Dispatched to specific academic departments (Department Leads & Faculty).
  * **Freshmen & Student Welfare**: Targeted advisories (Guidance Counselors).

---

## 🔒 Role-Based Access Control (RBAC) Matrix

| Feature / Action | Principal | Teacher | Counselor | Student |
| :--- | :---: | :---: | :---: | :---: |
| **Switch Active Campus / Tenant** | ✅ | ✅ | ✅ | ✅ |
| **View Dashboard KPIs** | ✅ | ✅ | ✅ | ✅ |
| **View Full Student Directory** | ✅ | Limited | ✅ | Self Only |
| **Enroll New Students / Staff** | ✅ | ❌ | ✅ | ❌ |
| **Mark Daily Attendance Roll Call** | ✅ | ✅ | ❌ | ❌ |
| **Close Attendance Sessions** | ✅ | ✅ | ❌ | ❌ |
| **View Attendance Statistics** | ✅ | ❌ | ✅ | ❌ |
| **Update Campus Asset Status** | ✅ | ❌ | ❌ | ❌ |
| **Decommission / Delete Asset** | ✅ | ❌ | ❌ | ❌ |
| **View Full Financial Ledger** | ✅ | ❌ | ❌ | ❌ |
| **View Financial Projections** | ✅ | ❌ | ❌ | ❌ |
| **Pay Tuition / Make Payments** | ✅ | ✅ | ✅ | ✅ |
| **Dispatch School-Wide Circulars** | ✅ | ❌ | ❌ | ❌ |
| **Dispatch Departmental Notices** | ✅ | ❌ | ❌ | ❌ |

---

## 🛠️ Technology Stack

```
SchoolBook SMS Framework
├── Backend
│   ├── Runtime: Node.js (v18+ / v20+)
│   ├── Language: TypeScript 5.4+ (Strict Mode)
│   ├── Server: Express 4.19
│   ├── Dev Server: tsx (watch mode with zero-restart transpile)
│   └── Persistence: Atomic JSON Local Ledger + PostgreSQL Schema (schema.sql)
├── Frontend
│   ├── Architecture: Modular TypeScript Single-Page Application (SPA)
│   ├── Bundler: esbuild (Target: ES2022)
│   ├── Styling: Vanilla Modern CSS3 (Variables, Flexbox/Grid, Glassmorphism)
│   └── Assets: Google Fonts (Inter, Outfit), FontAwesome Pro 6 Icons
└── Contracts
    └── Shared Interfaces: src/shared/types.ts (100% typed contracts)
```

---

## 📁 Repository Directory Structure

```plaintext
c:\Users\Administrator\Desktop\Churchbook\
├── database.json              # Atomic local JSON database (auto-seeded on first launch)
├── package.json               # Node package configuration & NPM scripts
├── schema.sql                 # Production-ready PostgreSQL relational schema
├── tsconfig.json              # TypeScript root compiler configuration
├── README.md                  # Project documentation & reference manual
│
├── src/
│   ├── shared/                # Strongly-typed contracts shared across full stack
│   │   └── types.ts           # Roles, Tenant, Member, Attendance, Financials, Inventory
│   │
│   ├── backend/               # Modular Express API Server
│   │   ├── server.ts          # Express application entrypoint, middlewares & router mounts
│   │   ├── db/
│   │   │   └── db.ts          # Database repository, seed logic & 30-day attendance engine
│   │   ├── middleware/
│   │   │   ├── tenant.ts      # Multi-tenant context extraction & verification
│   │   │   └── auth.ts        # RBAC verification & role authorization middlewares
│   │   └── routes/
│   │       ├── members.ts     # Student & faculty directory, profiles, enrollment
│   │       ├── attendance.ts  # Roll call sheets, session closing & stats
│   │       ├── inventory.ts   # Campus assets & lab equipment tracking
│   │       ├── financials.ts  # Payment gateway, tuition ledger & linear forecasting
│   │       ├── messaging.ts   # Institutional circulars & broadcast engine
│   │       └── units.ts       # Academic faculties, departments & class cohorts
│   │
│   └── frontend/              # Client-Side Dashboard Application
│       ├── index.html         # Main application markup & modal dialog containers
│       ├── app.js             # Compiled production bundle (generated via esbuild)
│       ├── app.js.map         # Source map for in-browser debugging
│       ├── css/
│       │   └── index.css      # Design system, CSS custom properties & component styles
│       └── ts/                # Modular TypeScript Frontend Source
│           ├── main.ts        # Client controller entry point & tab lifecycle router
│           ├── state.ts       # Reactive client-side state store & RBAC helper methods
│           ├── types.ts       # Frontend-specific UI view contracts
│           ├── api.ts         # Type-safe Fetch wrapper with tenant header injection
│           ├── rbac.ts        # Dynamic DOM permission gating & UI element visibility
│           ├── modals.ts      # Modal dialog event listeners & form handlers
│           └── tabs/
│               ├── overviewTab.ts    # KPI metric cards & recent session summaries
│               ├── membersTab.ts     # Student & faculty directory table & profile cards
│               ├── attendanceTab.ts  # Roll call sheet & performance analytics
│               ├── inventoryTab.ts   # Campus inventory register & status toggles
│               ├── financialsTab.ts  # Payment gateway submission & tuition ledger
│               └── broadcastTab.ts   # School circular composer & notice feed
```

---

## 🔌 REST API Specification

All protected endpoints require tenant and user context passed via HTTP headers:

| Header Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `x-tenant-id` | `string` | Target campus tenant identifier | `tenant_oakridge` |
| `x-user-role` | `string` | Role of active user (`Principal`, `Teacher`, `Counselor`, `Student`) | `Principal` |
| `x-user-id` | `string` | Member profile ID of active user | `m_oak_principal` |

### Core Endpoints

#### 1. Tenants & Auth Profiles
* `GET /api/tenants` — List all registered academic campuses.
* `GET /api/auth/profiles?tenantId=:id` — Fetch member personas for profile switching.

#### 2. Student & Staff Directory
* `GET /api/members` — Fetch directory of enrolled students and faculty (role-pruned).
* `POST /api/members` — Enroll a new student or faculty member.
* `GET /api/members/:id` — View complete profile (full contact info restricted to Principal/Counselor).
* `DELETE /api/members/:id` — Withdraw / remove student or faculty profile (Principal only).

#### 3. Roll Call Attendance
* `GET /api/attendance/sheet?date=YYYY-MM-DD&serviceName=Name` — Fetch roll call sheet for a session.
* `POST /api/attendance/mark` — Toggle student attendance status (`Present` / `Absent`).
* `POST /api/attendance/close-service` — Finalize roll call session; marks unrecorded students as Absent.
* `GET /api/attendance/stats?type=faculty` — Fetch attendance consistency percentages.

#### 4. Campus Inventory & Labs
* `GET /api/inventory` — List campus physical equipment and laboratory apparatus.
* `POST /api/inventory` — Register new campus asset (Department leads & Principal).
* `PATCH /api/inventory/:id/status` — Update asset status (`Active`, `Faulty`, `Unavailable`).
* `DELETE /api/inventory/:id` — Decommission asset from register (Principal only).

#### 5. Financials & Tuition
* `GET /api/financials` — Fetch ledger of tuition payments (Principal & Bursar only).
* `POST /api/financials/pay` — Submit payment through secure mock gateway.
* `GET /api/financials/projections` — Calculate rolling revenue totals and predictive growth.

#### 6. Circulars & Notifications
* `GET /api/messaging/broadcasts` — List published circulars for the campus.
* `POST /api/messaging/broadcast` — Dispatch an official institutional circular.

---

## 💻 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **NPM**: v9.0.0 or higher
* **PowerShell** (Windows) or **Bash** (macOS / Linux)

### Installation

1. **Clone or navigate to the repository directory**:
   ```powershell
   cd c:\Users\Administrator\Desktop\Churchbook
   ```

2. **Install project dependencies**:
   ```powershell
   npm install
   ```

3. **Compile the frontend TypeScript bundle**:
   ```powershell
   npm run build:fe
   ```

4. **Launch the development server**:
   ```powershell
   npm run dev
   ```

5. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 📜 NPM Scripts Reference

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx watch src/backend/server.ts` | Starts live backend server with hot auto-reload on file edits |
| `npm run build:fe`| `esbuild src/frontend/ts/main.ts ...` | Compiles TypeScript frontend into `src/frontend/app.js` with sourcemaps |
| `npm run watch:fe`| `esbuild ... --watch` | Watches frontend TypeScript files and automatically rebundles on save |
| `npm run build:be`| `tsc` | Compiles backend TypeScript files into `dist/` |
| `npm run build` | `npm run build:fe && npm run build:be` | Complete end-to-end production build |
| `npm run typecheck`| `tsc --noEmit` | Strict full-codebase TypeScript static type check |
| `npm start` | `node dist/backend/server.js` | Runs compiled production server |

---

## 🗄️ Database Architecture

* **Development & Local Execution**: Stored in [`database.json`](file:///c:/Users/Administrator/Desktop/Churchbook/database.json). If this file is deleted, the server automatically regenerates full seed data on startup.
* **Production Deployment**: A complete relational PostgreSQL schema is provided in [`schema.sql`](file:///c:/Users/Administrator/Desktop/Churchbook/schema.sql), featuring foreign key cascades, unique compound constraints, and multi-tenant performance indexes (`tenant_id`).

---

## 📄 License
This project is proprietary software developed for academic management operations. All rights reserved.
