package main

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Locate the bot directory relative to backend or current working directory
func getBotDir() string {
	candidates := []string{
		"../bot",
		"./bot",
		"../../bot",
		"/opt/render/project/src/bot",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			if _, err := os.Stat(filepath.Join(c, "index.js")); err == nil {
				abs, err := filepath.Abs(c)
				if err == nil {
					return abs
				}
				return c
			}
		}
	}
	return ""
}

// Download and unpack tar.gz into targetDir
func downloadAndExtractTarGz(downloadURL, targetDir, stripPrefix string) error {
	resp, err := http.Get(downloadURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	gzReader, err := gzip.NewReader(resp.Body)
	if err != nil {
		return err
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return err
	}

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		relPath := header.Name
		if stripPrefix != "" && strings.HasPrefix(relPath, stripPrefix) {
			relPath = strings.TrimPrefix(relPath, stripPrefix)
			relPath = strings.TrimPrefix(relPath, "/")
		}
		if relPath == "" {
			continue
		}

		destPath := filepath.Join(targetDir, relPath)
		switch header.Typeflag {
		case tar.TypeDir:
			_ = os.MkdirAll(destPath, 0755)
		case tar.TypeReg:
			_ = os.MkdirAll(filepath.Dir(destPath), 0755)
			outFile, err := os.OpenFile(destPath, os.O_CREATE|os.O_RDWR|os.O_TRUNC, header.FileInfo().Mode())
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()
		case tar.TypeSymlink:
			_ = os.MkdirAll(filepath.Dir(destPath), 0755)
			_ = os.Remove(destPath)
			_ = os.Symlink(header.Linkname, destPath)
		}
	}
	return nil
}

// Ensure Node and npm binaries are available
func ensureNodeBinary() (string, string, error) {
	// 1. Check if node and npm are already in system PATH
	nodePath, errNode := exec.LookPath("node")
	npmPath, errNpm := exec.LookPath("npm")
	if errNode == nil {
		if errNpm != nil {
			npmPath = ""
		}
		return nodePath, npmPath, nil
	}

	// 2. Check if pre-downloaded in temp directory
	tmpNodeDir := filepath.Join(os.TempDir(), "node_standalone")
	candidateNode := filepath.Join(tmpNodeDir, "bin", "node")
	candidateNpm := filepath.Join(tmpNodeDir, "bin", "npm")
	if runtime.GOOS == "windows" {
		candidateNode = filepath.Join(tmpNodeDir, "node.exe")
		candidateNpm = filepath.Join(tmpNodeDir, "npm.cmd")
	}

	if _, err := os.Stat(candidateNode); err == nil {
		return candidateNode, candidateNpm, nil
	}

	// 3. If running on Linux (e.g. Render container), download official prebuilt Node.js 20 tar.gz
	if runtime.GOOS == "linux" && runtime.GOARCH == "amd64" {
		log.Println("⚡ [Bot Supervisor] Node.js not found in PATH. Downloading standalone Node.js 20 for Linux...")
		downloadURL := "https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.gz"
		if err := downloadAndExtractTarGz(downloadURL, tmpNodeDir, "node-v20.18.0-linux-x64"); err != nil {
			return "", "", fmt.Errorf("failed to download standalone Node.js: %w", err)
		}
		log.Println("✅ [Bot Supervisor] Standalone Node.js 20 installed successfully in", tmpNodeDir)
		return candidateNode, candidateNpm, nil
	}

	return "", "", fmt.Errorf("node.js executable not found in PATH on %s/%s", runtime.GOOS, runtime.GOARCH)
}

// Ensure bot dependencies are installed
func ensureNodeModules(nodePath, npmPath, botDir string) error {
	nmPath := filepath.Join(botDir, "node_modules")
	if fi, err := os.Stat(nmPath); err == nil && fi.IsDir() {
		return nil
	}

	log.Println("📦 [Bot Supervisor] Installing bot dependencies via npm install...")
	var cmd *exec.Cmd
	if npmPath != "" {
		cmd = exec.Command(npmPath, "install", "--production")
	} else {
		npmCli := filepath.Join(filepath.Dir(nodePath), "../lib/node_modules/npm/bin/npm-cli.js")
		cmd = exec.Command(nodePath, npmCli, "install", "--production")
	}
	cmd.Dir = botDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Start and supervise the Telegram Bot in a background goroutine
func startTelegramBotSupervisor() {
	botDir := getBotDir()
	if botDir == "" {
		log.Println("⚠️ [Bot Supervisor] Could not locate bot directory. Skipping Telegram Bot startup.")
		return
	}

	log.Printf("🤖 [Bot Supervisor] Bot directory located at: %s", botDir)

	go func() {
		nodePath, npmPath, err := ensureNodeBinary()
		if err != nil {
			log.Printf("❌ [Bot Supervisor] Cannot start bot: %v", err)
			return
		}

		if err := ensureNodeModules(nodePath, npmPath, botDir); err != nil {
			log.Printf("⚠️ [Bot Supervisor] npm install warning: %v", err)
		}

		for {
			log.Printf("🚀 [Bot Supervisor] Launching DeskFlow Telegram Bot via %s...", nodePath)
			cmd := exec.Command(nodePath, "index.js")
			cmd.Dir = botDir

			// Ensure PORT=5001 so it doesn't conflict with Go backend on PORT 10000 / 8080
			env := os.Environ()
			hasPort := false
			for i, e := range env {
				if strings.HasPrefix(e, "PORT=") {
					env[i] = "PORT=5001"
					hasPort = true
					break
				}
			}
			if !hasPort {
				env = append(env, "PORT=5001")
			}
			cmd.Env = env

			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Start(); err != nil {
				log.Printf("❌ [Bot Supervisor] Failed to start bot: %v. Retrying in 5s...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			log.Printf("✅ [Bot Supervisor] DeskFlow Telegram Bot started (PID: %d)", cmd.Process.Pid)
			_ = cmd.Wait()
			log.Println("⚠️ [Bot Supervisor] Telegram bot process exited. Auto-restarting in 3s...")
			time.Sleep(3 * time.Second)
		}
	}()
}
