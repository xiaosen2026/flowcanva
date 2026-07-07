package main

import (
	"log/slog"
	"os/exec"
	"runtime"
	"time"
)

func main() {
	cfg := loadConfig()
	logger := initLogger()
	slog.SetDefault(logger)

	logger.Info("starting server",
		"port", cfg.Port,
		"dev_mode", cfg.DevMode,
		"db_path", cfg.DBPath,
	)

	db, err := initDB(cfg.DBPath, logger)
	if err != nil {
		logger.Error("database init failed", "error", err)
		panic(err)
	}
	defer db.Close()

	h := &Handler{db: db, log: logger}
	r := setupRouter(h, cfg)

	logger.Info("server ready", "port", cfg.Port)

	if cfg.Embedded {
		go func() {
			time.Sleep(800 * time.Millisecond)
			url := "http://localhost" + cfg.Port
			logger.Info("opening browser", "url", url)
			openBrowser(url)
		}()
	}

	if err := r.Run(cfg.Port); err != nil {
		logger.Error("server failed", "error", err)
		panic(err)
	}
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("cmd", "/c", "start", url).Start()
	case "darwin":
		_ = exec.Command("open", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
}
