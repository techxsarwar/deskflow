# DeskFlow 🪑📚

> **Modern Study Lounge & Library Management Operating System** built with React, Vite, TailwindCSS, Shadcn UI, and Supabase.

DeskFlow is a comprehensive management platform designed specifically for study lounges, reading rooms, and co-working libraries. It replaces manual registers and fragmented spreadsheets with visual seat management, automated membership lifecycles, and WhatsApp communication tools.

---

## ✨ Key Features

### 🪑 Visual Seating Chart & Allocation
- **Interactive Floor Plan:** Color-coded floor plan divided into zones (*Silent Reading Hall*, *Flexi Open Zone*, *Private Executive Cabins*).
- **Dedicated 24/7 Desks:** Every seat is strictly dedicated to the paying student with real-time occupancy indicators.
- **1-Click Seat Assignment & Reallocation:** Assign unassigned students or vacate desks with one click.
- **WhatsApp Seating Arrangement Sharing:** Generate and share complete room-by-room seating rosters directly to student community groups.

### 📅 Membership Lifecycle & Overdue Auto-Release
- **Smart Lifecycle Tracking:**
  - 🟢 **Active:** Normal ongoing membership with countdown of days left.
  - 🟡 **Expiring Soon:** Highlighted 3 days prior to expiration.
  - 🟠 **Grace Period:** 0–2 days post-expiry protection while staff follows up.
  - 🔴 **Overdue / Expired:** Desks held past grace period flagged on floor plan.
- **1-Click Auto-Release Desks:** Batch or individually vacate overdue seats so paying students can be allotted desks immediately.

### 🔄 Rolling Monthly Renewals
- **1-Click Extend (+1, +2, +3 Months):** Automatically calculates the next renewal date preserving the student's rolling billing cycle (e.g. 15th to 15th).
- **Instant Payment Logging:** Records partial or full renewal fees, updates balances, and logs timestamped ledger transactions.
- **WhatsApp Renewal Pass:** Automatically generates an official renewal confirmation pass with valid-till dates and sends it to the student.

### 💳 Ultra-Detailed Fee Collection & PDF Receipts
- **Timestamped Ledger:** Tracks every payment mode (Cash, UPI, Card, Net Banking).
- **Instant Receipts:** Generates downloadable & printable professional fee receipts.
- **Editable Custom Text:** Edit notes or instructions before forwarding.
- **WhatsApp Receipt Forwarding:** One-click redirect to send pre-formatted receipts directly to the student's WhatsApp number.

### 📢 Dues & Defaulter Follow-ups
- **Outstanding Balances Filter:** Instantly view students with overdue payments.
- **Community Broadcast Reminders:** Pre-formats professional announcement messages ready to copy or share directly into WhatsApp announcement groups.

### 🌐 Public Self-Registration (`/join`)
- **Self-Service Onboarding:** Clean mobile-friendly portal where prospective students select their plan, preferred desk, and upload their photo.
- **Admin Verification Queue:** New submissions appear in an online admissions queue where staff can verify documents and collect fees before granting permanent desk access.
- **Supabase Cloud Storage:** Student profile photos are securely stored in Supabase Storage.

---

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, TailwindCSS
- **UI Components:** Shadcn UI, Radix Primitives, Lucide Icons
- **State Management:** Zustand with LocalStorage fallback & Supabase sync
- **Routing:** TanStack Router
- **Cloud Backend:** Supabase (PostgreSQL Database & S3-compatible Storage)
- **Go Backend (Optional):** Go 1.24 API server for local SQLite/PostgreSQL sync

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (or npm / yarn)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/techxsarwar/deskflow.git
   cd deskflow
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=http://localhost:8080
   ```

4. **Run the Development Server:**
   ```bash
   pnpm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

Copyright © 2026 Sarwar Altaf Dar ([techxsarwar](https://github.com/techxsarwar)). **All Rights Reserved**.

This software and associated documentation files are proprietary and confidential. Unauthorized copying, modification, distribution, or use of this codebase, via any medium, is strictly prohibited without the express written permission of the copyright holder.
