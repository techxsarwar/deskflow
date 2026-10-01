package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/lib/pq"
)

func main() {
	// Read DATABASE_URL from .env
	content, err := os.ReadFile(".env")
	if err != nil {
		content, err = os.ReadFile("../.env")
	}

	var dbURL string
	if err == nil {
		for _, line := range strings.Split(string(content), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "DATABASE_URL=") {
				dbURL = strings.TrimPrefix(line, "DATABASE_URL=")
				dbURL = strings.Trim(dbURL, `"'`)
				break
			}
		}
	}

	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}

	if dbURL == "" {
		log.Fatal("DATABASE_URL not found")
	}

	if !strings.Contains(dbURL, "sslmode=") {
		if strings.Contains(dbURL, "?") {
			dbURL += "&sslmode=require"
		} else {
			dbURL += "?sslmode=require"
		}
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Ping failed: %v", err)
	}
	fmt.Println("Connected to Supabase PostgreSQL!")

	queries := []string{
		`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;`,
		`INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT (id) DO UPDATE SET public = true;`,
		`DROP POLICY IF EXISTS "Public Access to Student Photos" ON storage.objects;`,
		`CREATE POLICY "Public Access to Student Photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'student-photos');`,
		`DROP POLICY IF EXISTS "Allow Upload Student Photos" ON storage.objects FOR INSERT;`,
		`CREATE POLICY "Allow Upload Student Photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'student-photos');`,
		`DROP POLICY IF EXISTS "Allow Update Student Photos" ON storage.objects FOR UPDATE;`,
		`CREATE POLICY "Allow Update Student Photos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'student-photos');`,
	}

	for _, q := range queries {
		_, err := db.Exec(q)
		if err != nil {
			fmt.Printf("Query error on '%s': %v\n", q, err)
		} else {
			fmt.Printf("Executed: %s\n", q)
		}
	}

	fmt.Println("Storage bucket 'student-photos' and policies configured successfully!")
}
