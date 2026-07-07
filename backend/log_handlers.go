package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListLogs(c *gin.Context) {
	level := c.Query("level")
	module := c.Query("module")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")

	query := `SELECT id, level, module, message, detail, created_at FROM logs WHERE 1=1`
	args := []any{}

	if level != "" {
		query += ` AND level = ?`
		args = append(args, level)
	}
	if module != "" {
		query += ` AND module = ?`
		args = append(args, module)
	}
	query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		h.log.Error("list logs", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	logs := []LogEntry{}
	for rows.Next() {
		var l LogEntry
		if err := rows.Scan(&l.ID, &l.Level, &l.Module, &l.Message, &l.Detail, &l.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		logs = append(logs, l)
	}
	c.JSON(http.StatusOK, logs)
}
