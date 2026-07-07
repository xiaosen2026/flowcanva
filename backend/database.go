package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"

	_ "modernc.org/sqlite"
)

func initDB(path string, log *slog.Logger) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path+"?_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

		if err := migrate(db, log); err != nil {
		return nil, err
	}

	log.Info("database initialized", "path", path)
	return db, nil
}

func migrate(db *sql.DB, log *slog.Logger) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS canvases (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL DEFAULT '',
			project_type TEXT NOT NULL DEFAULT 'canvas',
			created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
			updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS nodes (
			id         TEXT PRIMARY KEY,
			canvas_id  TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
			node_type  TEXT NOT NULL DEFAULT 'text',
			x          REAL NOT NULL DEFAULT 0,
			y          REAL NOT NULL DEFAULT 0,
			width      REAL NOT NULL DEFAULT 280,
			height     REAL NOT NULL DEFAULT 200,
			content    TEXT NOT NULL DEFAULT '',
			config     TEXT NOT NULL DEFAULT '{}',
			created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS node_configs (
			id              TEXT PRIMARY KEY,
			node_type       TEXT UNIQUE NOT NULL,
			model_name      TEXT NOT NULL DEFAULT '',
			api_channel     TEXT NOT NULL DEFAULT '',
			base_url        TEXT NOT NULL DEFAULT '',
			api_key         TEXT NOT NULL DEFAULT '',
			parameters      TEXT NOT NULL DEFAULT '{}',
			prompt_template TEXT NOT NULL DEFAULT '',
			extra_config    TEXT NOT NULL DEFAULT '{}',
			enabled         INTEGER NOT NULL DEFAULT 1,
			created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
			updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS logs (
			id         TEXT PRIMARY KEY,
			level      TEXT NOT NULL DEFAULT 'INFO',
			module     TEXT NOT NULL DEFAULT '',
			message    TEXT NOT NULL DEFAULT '',
			detail     TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS assets (
			id         TEXT PRIMARY KEY,
			filename   TEXT NOT NULL DEFAULT '',
			url        TEXT NOT NULL DEFAULT '',
			size       INTEGER NOT NULL DEFAULT 0,
			width      INTEGER NOT NULL DEFAULT 0,
			height     INTEGER NOT NULL DEFAULT 0,
			category   TEXT NOT NULL DEFAULT '其他',
			tags       TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS presets (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL DEFAULT '',
			prompt      TEXT NOT NULL DEFAULT '',
			category    TEXT NOT NULL DEFAULT '通用',
			preset_type TEXT NOT NULL DEFAULT 'image',
			scope       TEXT NOT NULL DEFAULT 'global',
			canvas_id   TEXT NOT NULL DEFAULT '',
			created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
		`CREATE TABLE IF NOT EXISTS edges (
			id             TEXT PRIMARY KEY,
			canvas_id      TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
			source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
			target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
			created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return err
		}
	}

	// seed default node configs if not exist
	types := []string{"text", "image", "video", "table", "full_image", "agent", "workflow", "asset", "director"}
	for _, t := range types {
		_, err := db.Exec(
			`INSERT OR IGNORE INTO node_configs (id, node_type) VALUES (?, ?)`,
			"cfg_"+t, t,
		)
		if err != nil {
			return err
		}
	}

	// apply seed data from embedded seed.json
	raw := EmbeddedSeedJSON
	if len(raw) > 0 {
		var seed struct {
			NodeConfigs map[string]struct {
				ModelName   string         `json:"model_name"`
				APIChannel  string         `json:"api_channel"`
				BaseURL     string         `json:"base_url"`
				APIKey      string         `json:"api_key"`
				Parameters  map[string]any `json:"parameters"`
				ExtraConfig map[string]any `json:"extra_config"`
			} `json:"node_configs"`
		}
		if json.Unmarshal(raw, &seed) == nil {
			for nodeType, cfg := range seed.NodeConfigs {
				paramsJSON, _ := json.Marshal(cfg.Parameters)
				extraJSON, _ := json.Marshal(cfg.ExtraConfig)
				_, err := db.Exec(
					`UPDATE node_configs SET model_name=?, api_channel=?, base_url=?, api_key=?, parameters=?, extra_config=?, updated_at=datetime('now','localtime') WHERE node_type=? AND model_name=''`,
					cfg.ModelName, cfg.APIChannel, cfg.BaseURL, cfg.APIKey, string(paramsJSON), string(extraJSON), nodeType,
				)
				if err != nil {
					log.Info("seed apply failed", "type", nodeType, "error", err)
				}
			}
		}
	}

	// ensure upload dir exists
	_ = os.MkdirAll("uploads", 0755)

	// backward-compat: add category/tags columns to existing assets table
	addColsIfMissing(db, "assets", []string{"category TEXT NOT NULL DEFAULT '其他'", "tags TEXT NOT NULL DEFAULT '[]'"})

	// backward-compat: add project_type column to canvases
	addColsIfMissing(db, "canvases", []string{"project_type TEXT NOT NULL DEFAULT 'canvas'"})

	// backward-compat: add preset_type column to presets
	addColsIfMissing(db, "presets", []string{"preset_type TEXT NOT NULL DEFAULT 'image'"})

	// performance index for asset pagination
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at)`)

	return nil
}

// addColsIfMissing adds columns to a table if they don't exist (SQLite compat)
func addColsIfMissing(db *sql.DB, table string, cols []string) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return
	}
	defer rows.Close()
	existing := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return
		}
		existing[name] = true
	}
	for _, c := range cols {
		parts := strings.SplitN(c, " ", 2)
		colName := parts[0]
		if existing[colName] {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s", table, c)); err != nil {
			// column may already exist or add unsupported; ignore
			continue
		}
	}
}
