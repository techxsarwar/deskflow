# Vertical Classes Library - Golang Backend API

High-performance, lightweight Go backend server for Vertical Classes Library & Study Management.

## Features

- **Students Records API:** List, Enroll, Update, Delete, and Approve online applicants.
- **Public Student Registration:** Direct endpoint (`POST /api/public/register`) for student mobile self-registration.
- **Fee Management & Receipts:** Track plan amounts, collect partial/full fees via UPI/Cash/Card, and generate transaction receipts.
- **Desk Layout & Occupancy:** Real-time seat matrix across Silent Hall, Flexi Zone, and Executive Cabins.
- **Dashboard Analytics:** Live KPIs for active students, total dues, revenue, and shift slot utilization.
- **Zero-Config Persistent Storage:** Embedded JSON store in `./data/study_lounge_data.json` that requires no separate database setup.
- **Full CORS Support:** Ready for Vite React frontend (`http://localhost:5173`).

---

## Prerequisites & Installation

Go 1.22+ required.

To run the server:
```bash
cd backend
go run main.go
```

The server starts on `http://localhost:8080`.

---

## API Endpoints

### System
- `GET /health` - Health check

### Dashboard
- `GET /api/dashboard` - Summary KPIs, occupancy rate, dues, and shift distribution

### Students
- `GET /api/students` - List all students (supports `?search=`, `?shift=`, `?status=`)
- `GET /api/students/{id}` - Get student by ID
- `POST /api/students` - Enroll a student
- `PUT /api/students/{id}` - Update student record
- `DELETE /api/students/{id}` - Remove student record
- `POST /api/students/{id}/approve` - Approve online applicant and assign desk

### Public Admission (No auth required)
- `POST /api/public/register` - Student self-registration form submission

### Fees & Receipts
- `GET /api/fees/transactions` - List all payment receipts
- `POST /api/fees/collect` - Collect fee, update balance due, and issue receipt

### Desks & Seats
- `GET /api/seats` - List all 30 lounge desks and occupancy status
- `POST /api/seats/assign` - Assign or move student desk
