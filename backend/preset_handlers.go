package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Preset struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Prompt     string `json:"prompt"`
	Category   string `json:"category"`
	PresetType string `json:"preset_type"`
	Scope      string `json:"scope"`
	CanvasID   string `json:"canvas_id"`
	CreatedAt  string `json:"created_at"`
}

func (h *Handler) ListPresets(c *gin.Context) {
	scope := c.DefaultQuery("scope", "")
	canvasID := c.DefaultQuery("canvas_id", "")

	where := ""
	args := []any{}
	if scope != "" {
		where = " WHERE scope = ?"
		args = append(args, scope)
	}
	if canvasID != "" {
		if where == "" {
			where = " WHERE (scope = 'canvas' AND canvas_id = ?)"
		} else {
			where += " OR (scope = 'canvas' AND canvas_id = ?)"
		}
		args = append(args, canvasID)
	}

	rows, err := h.db.Query(`SELECT id, name, prompt, category, preset_type, scope, canvas_id, created_at FROM presets`+where+` ORDER BY preset_type, category, name`, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	presets := []Preset{}
	for rows.Next() {
		var p Preset
		if err := rows.Scan(&p.ID, &p.Name, &p.Prompt, &p.Category, &p.PresetType, &p.Scope, &p.CanvasID, &p.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		presets = append(presets, p)
	}
	c.JSON(http.StatusOK, presets)
}

func (h *Handler) CreatePreset(c *gin.Context) {
	var body Preset
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p := Preset{
		ID:         "pr_" + uuid.New().String()[:8],
		Name:       body.Name,
		Prompt:     body.Prompt,
		Category:   body.Category,
		PresetType: body.PresetType,
		Scope:      body.Scope,
		CanvasID:   body.CanvasID,
	}
	if p.Category == "" {
		p.Category = "通用"
	}
	if p.PresetType == "" {
		p.PresetType = "image"
	}
	if p.Scope != "canvas" {
		p.Scope = "global"
	}

	_, err := h.db.Exec(`INSERT INTO presets (id, name, prompt, category, preset_type, scope, canvas_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Prompt, p.Category, p.PresetType, p.Scope, p.CanvasID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.log.Info("preset created", "id", p.ID, "scope", p.Scope)
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) UpdatePreset(c *gin.Context) {
	id := c.Param("id")
	var body Preset
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.db.Exec(`UPDATE presets SET name=?, prompt=?, category=?, preset_type=?, scope=?, canvas_id=? WHERE id=?`,
		body.Name, body.Prompt, body.Category, body.PresetType, body.Scope, body.CanvasID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) DeletePreset(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(`DELETE FROM presets WHERE id=?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
