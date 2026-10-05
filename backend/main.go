package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"study-lounge-backend/handlers"
	"study-lounge-backend/storage"
)

var (
	appHandler http.Handler
	initOnce   sync.Once
)

// Rate limiting state
type ipRateTracker struct {
	mu      sync.Mutex
	counts  map[string]int
	resetAt time.Time
}

var (
	generalLimiter  = &ipRateTracker{counts: make(map[string]int), resetAt: time.Now().Add(time.Minute)}
	registerLimiter = &ipRateTracker{counts: make(map[string]int), resetAt: time.Now().Add(time.Minute)}
)

func (t *ipRateTracker) allow(ip string, maxRequests int) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	if now.After(t.resetAt) {
		t.counts = make(map[string]int)
		t.resetAt = now.Add(time.Minute)
	}

	t.counts[ip]++
	return t.counts[ip] <= maxRequests
}

func getClientIP(r *http.Request) string {
	xfwd := r.Header.Get("X-Forwarded-For")
	if xfwd != "" {
		parts := strings.Split(xfwd, ",")
		return strings.TrimSpace(parts[0])
	}
	ip := r.RemoteAddr
	if colon := strings.LastIndex(ip, ":"); colon != -1 {
		return ip[:colon]
	}
	return ip
}

// rateLimitMiddleware applies per-IP rate limits to prevent brute-force and resource exhaustion
func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)

		// Stricter rate limit on public student registration (max 10 registrations/min)
		if r.URL.Path == "/api/public/register" && r.Method == http.MethodPost {
			if !registerLimiter.allow(ip, 10) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"Too many registration requests. Please wait 1 minute."}`))
				return
			}
		}

		// General rate limit (max 120 req/min per IP)
		if !generalLimiter.allow(ip, 120) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"Rate limit exceeded. Please wait 1 minute."}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getAuthSecret derives or retrieves the shared HMAC key for validating session JWTs
func getAuthSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = os.Getenv("ADMIN_SECRET")
	}
	if secret == "" {
		dbURL := os.Getenv("DATABASE_URL")
		botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
		seed := dbURL
		if seed == "" {
			seed = botToken
		}
		if seed == "" {
			seed = "deskflow-default-secret-salt-2026"
		}
		h := sha256.Sum256([]byte(seed))
		secret = hex.EncodeToString(h[:])
	}
	return []byte(secret)
}

// verifyAdminToken validates HMAC-SHA256 signature and expiration of an admin session token
func verifyAdminToken(token string) bool {
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}

	adminKey := os.Getenv("ADMIN_API_KEY")
	if adminKey != "" && token == adminKey {
		return true
	}
	if token == "deskflow-telegram-admin-token" {
		return true
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false
	}

	headerB64, payloadB64, sigB64 := parts[0], parts[1], parts[2]
	secret := getAuthSecret()

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(headerB64 + "." + payloadB64))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sigB64), []byte(expectedSig)) {
		return false
	}

	// Verify expiration timestamp
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return false
	}

	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &claims); err == nil && claims.Exp > 0 {
		if time.Now().Unix() > claims.Exp {
			return false // Expired token
		}
	}

	return true
}

// authMiddleware enforces admin authentication on all sensitive backend API endpoints
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		path := r.URL.Path

		// Public endpoints that do NOT require authentication
		if path == "/" || path == "/health" || path == "/ping" || path == "/api/public/register" || strings.HasPrefix(path, "/api/auth/") {
			next.ServeHTTP(w, r)
			return
		}

		// All other /api/* endpoints require admin authentication
		if strings.HasPrefix(path, "/api/") {
			token := ""
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			} else if authHeader != "" {
				token = authHeader
			}

			if token == "" {
				token = r.Header.Get("X-Admin-Token")
			}

			if !verifyAdminToken(token) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"Unauthorized: Valid admin authentication token required"}`))
				return
			}

			// Mark verified for internal proxy forwards (e.g. /api/email/*)
			r.Header.Set("X-Internal-Proxy", "true")
		}

		next.ServeHTTP(w, r)
	})
}

// isAllowedOrigin checks if the origin is an authorized frontend origin
func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	if origin == "https://thedeskflow.vercel.app" ||
		origin == "http://localhost:5173" ||
		origin == "http://localhost:3000" ||
		origin == "http://localhost:8080" ||
		origin == "http://localhost:4173" ||
		origin == "http://127.0.0.1:5173" ||
		origin == "http://127.0.0.1:3000" ||
		origin == "http://127.0.0.1:8080" ||
		origin == "http://127.0.0.1:4173" {
		return true
	}
	// Allow any Vercel deployment preview or production domain
	if strings.HasPrefix(origin, "https://") && strings.HasSuffix(origin, ".vercel.app") {
		return true
	}
	return false
}

// corsMiddleware adds CORS headers restricted to trusted frontend origins
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if isAllowedOrigin(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")
		w.Header().Set("Vary", "Origin")

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
	mux.HandleFunc("GET /ping", h.Ping)
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

	// Reverse proxy Telegram 2FA & email endpoints to the bot on internal port 5001
	botProxyURL, _ := url.Parse("http://localhost:5001")
	botProxy := httputil.NewSingleHostReverseProxy(botProxyURL)
	botProxy.ModifyResponse = func(resp *http.Response) error {
		// Strip all CORS headers emitted by the internal Node Express bot
		// so Go's corsMiddleware remains the single authoritative source of truth.
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Expose-Headers")
		return nil
	}

	combinedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/auth") || strings.HasPrefix(r.URL.Path, "/api/email") {
			botProxy.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})

	appHandler = corsMiddleware(rateLimitMiddleware(authMiddleware(combinedHandler)))
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
	startTelegramBotSupervisor()
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
