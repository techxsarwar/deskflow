package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"study-lounge-backend/models"
	"study-lounge-backend/storage"
)

type Handler struct {
	store *storage.Store
}

func NewHandler(store *storage.Store) *Handler {
	return &Handler{store: store}
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	bytes, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.WriteHeader(status)
	_, _ = w.Write(bytes)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// GET /ping or keepalive ping for cron services
func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Content-Length", "2")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// GET /
func (h *Handler) RootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"service":   "Vertical Classes Library Backend API",
		"status":    "running",
		"version":   "1.0.0",
		"message":   "DeskFlow Golang backend server is online and operational.",
		"endpoints": []string{"/health", "/ping", "/api/dashboard", "/api/students", "/api/seats", "/api/fees/transactions"},
	})
}

// GET /api/health or /health
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "Vertical Classes Library Backend API",
		"version": "1.0.0",
	})
}

// GET /api/dashboard
func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	stats := h.store.GetDashboardStats()
	writeJSON(w, http.StatusOK, stats)
}

// GET /api/students
func (h *Handler) GetStudents(w http.ResponseWriter, r *http.Request) {
	students := h.store.GetAllStudents()

	query := strings.ToLower(r.URL.Query().Get("search"))
	shift := r.URL.Query().Get("shift")
	status := r.URL.Query().Get("status")

	if query == "" && (shift == "" || shift == "all") && (status == "" || status == "all") {
		writeJSON(w, http.StatusOK, students)
		return
	}

	var filtered []models.Student
	for _, s := range students {
		matchesQuery := query == "" ||
			strings.Contains(strings.ToLower(s.FullName), query) ||
			strings.Contains(strings.ToLower(s.Phone), query) ||
			strings.Contains(strings.ToLower(s.RegNo), query) ||
			strings.Contains(strings.ToLower(s.SeatNumber), query)

		matchesShift := shift == "" || shift == "all" || s.Shift == shift
		matchesStatus := status == "" || status == "all" || s.Status == status

		if matchesQuery && matchesShift && matchesStatus {
			filtered = append(filtered, s)
		}
	}

	writeJSON(w, http.StatusOK, filtered)
}

// GET /api/students/{id}
func (h *Handler) GetStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	student, found := h.store.GetStudentByID(id)
	if !found {
		writeError(w, http.StatusNotFound, "student not found")
		return
	}
	writeJSON(w, http.StatusOK, student)
}

// POST /api/students
func (h *Handler) CreateStudent(w http.ResponseWriter, r *http.Request) {
	var student models.Student
	if err := json.NewDecoder(r.Body).Decode(&student); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if student.FullName == "" || student.Phone == "" {
		writeError(w, http.StatusBadRequest, "fullName and phone are required")
		return
	}

	created, err := h.store.AddStudent(student)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// PUT /api/students/{id}
func (h *Handler) UpdateStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var update models.Student
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.store.UpdateStudent(id, update)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DELETE /api/students/{id}
func (h *Handler) DeleteStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !h.store.DeleteStudent(id) {
		writeError(w, http.StatusNotFound, "student not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "student deleted successfully"})
}

// POST /api/students/{id}/approve
func (h *Handler) ApproveStudent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		SeatNumber string `json:"seatNumber"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	student, err := h.store.ApproveStudent(id, req.SeatNumber)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, student)
}

// POST /api/public/register
func (h *Handler) PublicRegister(w http.ResponseWriter, r *http.Request) {
	var student models.Student
	if err := json.NewDecoder(r.Body).Decode(&student); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if student.FullName == "" || student.Phone == "" {
		writeError(w, http.StatusBadRequest, "fullName and phone are required")
		return
	}

	student.RegisteredVia = "online_link"
	student.Status = "pending"
	student.SeatNumber = "Unassigned"

	created, err := h.store.AddStudent(student)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// GET /api/fees/transactions
func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	txns := h.store.GetAllTransactions()
	writeJSON(w, http.StatusOK, txns)
}

// POST /api/fees/collect
func (h *Handler) CollectFee(w http.ResponseWriter, r *http.Request) {
	var req models.CollectFeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.StudentID == "" || req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "studentId and positive amount are required")
		return
	}

	if req.PaymentMode == "" {
		req.PaymentMode = "upi"
	}

	txn, err := h.store.CollectFee(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, txn)
}

// GET /api/seats
func (h *Handler) GetSeats(w http.ResponseWriter, r *http.Request) {
	seats := h.store.GetAllSeats()
	writeJSON(w, http.StatusOK, seats)
}

// POST /api/seats/assign
func (h *Handler) AssignSeat(w http.ResponseWriter, r *http.Request) {
	var req models.AssignSeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.StudentID == "" || req.SeatNumber == "" {
		writeError(w, http.StatusBadRequest, "studentId and seatNumber are required")
		return
	}

	if err := h.store.AssignSeat(req.StudentID, req.SeatNumber); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "seat assigned successfully"})
}
