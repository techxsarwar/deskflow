package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"study-lounge-backend/handlers"
	"study-lounge-backend/storage"
)

var (
	appHandler http.Handler
	initOnce   sync.Once
)

// corsMiddleware adds CORS headers to enable API calls from Vite frontend
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loadEnv() {
	paths := []string{".env", "../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					val := strings.TrimSpace(parts[1])
					if os.Getenv(key) == "" {
						os.Setenv(key, val)
					}
				}
			}
			break
		}
	}
}

func initServer() {
	loadEnv()

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	dbURL := os.Getenv("DATABASE_URL")
	store, err := storage.NewStore(dataDir, dbURL)
	if err != nil {
		log.Printf("Failed to initialize store: %v", err)
	}

	h := handlers.NewHandler(store)
	mux := http.NewServeMux()

	// API Routes
	mux.HandleFunc("GET /", h.RootHandler)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /api/dashboard", h.GetDashboard)

	// Students
	mux.HandleFunc("GET /api/students", h.GetStudents)
	mux.HandleFunc("POST /api/students", h.CreateStudent)
	mux.HandleFunc("GET /api/students/{id}", h.GetStudent)
	mux.HandleFunc("PUT /api/students/{id}", h.UpdateStudent)
	mux.HandleFunc("DELETE /api/students/{id}", h.DeleteStudent)
	mux.HandleFunc("POST /api/students/{id}/approve", h.ApproveStudent)

	// Public Admission Link
	mux.HandleFunc("POST /api/public/register", h.PublicRegister)

	// Fees & Transactions
	mux.HandleFunc("GET /api/fees/transactions", h.GetTransactions)
	mux.HandleFunc("POST /api/fees/collect", h.CollectFee)

	// Seats
	mux.HandleFunc("GET /api/seats", h.GetSeats)
	mux.HandleFunc("POST /api/seats/assign", h.AssignSeat)

	appHandler = corsMiddleware(mux)
}

// Handler is exported for Vercel Go Serverless execution if invoked as a function
func Handler(w http.ResponseWriter, r *http.Request) {
	initOnce.Do(initServer)
	if appHandler != nil {
		appHandler.ServeHTTP(w, r)
	} else {
		http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
	}
}

func main() {
	initOnce.Do(initServer)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("====================================================")
	fmt.Printf("📚 Vertical Classes Library - Golang Backend Server\n")
	fmt.Printf("🚀 Server running on http://localhost:%s\n", port)
	fmt.Println("----------------------------------------------------")
	fmt.Println("Endpoints:")
	fmt.Printf(" • GET    http://localhost:%s/health\n", port)
	fmt.Printf(" • GET    http://localhost:%s/api/dashboard\n", port)
	fmt.Printf(" • GET    http://localhost:%s/api/students\n", port)
	fmt.Printf(" • POST   http://localhost:%s/api/students\n", port)
	fmt.Printf(" • POST   http://localhost:%s/api/public/register\n", port)
	fmt.Printf(" • GET    http://localhost:%s/api/fees/transactions\n", port)
	fmt.Printf(" • POST   http://localhost:%s/api/fees/collect\n", port)
	fmt.Printf(" • GET    http://localhost:%s/api/seats\n", port)
	fmt.Printf(" • POST   http://localhost:%s/api/seats/assign\n", port)
	fmt.Println("====================================================")

	if err := http.ListenAndServe(":"+port, appHandler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
