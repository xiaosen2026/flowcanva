package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Edge handlers ────────────────────────────────────────────────────

func (h *Handler) ListEdges(c *gin.Context) {
	cid := c.Param("cid")
	rows, err := h.db.Query(`SELECT id, canvas_id, source_node_id, target_node_id, created_at FROM edges WHERE canvas_id = ?`, cid)
	if err != nil {
		h.log.Error("list edges", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	edges := []Edge{}
	for rows.Next() {
		var e Edge
		if err := rows.Scan(&e.ID, &e.CanvasID, &e.SourceNodeID, &e.TargetNodeID, &e.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		edges = append(edges, e)
	}
	c.JSON(http.StatusOK, edges)
}

func (h *Handler) CreateEdge(c *gin.Context) {
	cid := c.Param("cid")
	var body struct {
		SourceNodeID string `json:"source_node_id"`
		TargetNodeID string `json:"target_node_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// verify both nodes belong to this canvas
	for _, nid := range []string{body.SourceNodeID, body.TargetNodeID} {
		var exists string
		err := h.db.QueryRow(`SELECT id FROM nodes WHERE id = ? AND canvas_id = ?`, nid, cid).Scan(&exists)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "node not found in this canvas"})
			return
		}
		if err != nil {
			h.log.Error("create edge", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	e := Edge{
		ID:           "ed_" + uuid.New().String()[:8],
		CanvasID:     cid,
		SourceNodeID: body.SourceNodeID,
		TargetNodeID: body.TargetNodeID,
	}
	_, err := h.db.Exec(`INSERT INTO edges (id, canvas_id, source_node_id, target_node_id) VALUES (?, ?, ?, ?)`,
		e.ID, e.CanvasID, e.SourceNodeID, e.TargetNodeID)
	if err != nil {
		h.log.Error("create edge", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.log.Info("edge created", "id", e.ID, "source", e.SourceNodeID, "target", e.TargetNodeID)
	c.JSON(http.StatusCreated, e)
}

func (h *Handler) DeleteEdge(c *gin.Context) {
	cid := c.Param("cid")
	id := c.Param("id")
	_, err := h.db.Exec(`DELETE FROM edges WHERE id = ? AND canvas_id = ?`, id, cid)
	if err != nil {
		h.log.Error("delete edge", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
