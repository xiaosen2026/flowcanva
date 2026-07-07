package main

import (
	"database/sql"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	db  *sql.DB
	log *slog.Logger
}

// ─── Canvas handlers ────────────────────────────────────────────────

func (h *Handler) ListCanvases(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "12"))
	projectType := c.DefaultQuery("project_type", "")
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 12
	}
	offset := (page - 1) * pageSize

	whereClause := ""
	args := []any{}
	if projectType != "" {
		whereClause = " WHERE project_type = ?"
		args = append(args, projectType)
	}

	var total int
	if err := h.db.QueryRow("SELECT COUNT(*) FROM canvases"+whereClause, args...).Scan(&total); err != nil {
		h.log.Error("list canvases count", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	queryArgs := append(args, pageSize, offset)
	rows, err := h.db.Query(`SELECT id, name, project_type, created_at, updated_at FROM canvases`+whereClause+` ORDER BY updated_at DESC LIMIT ? OFFSET ?`, queryArgs...)
	if err != nil {
		h.log.Error("list canvases", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	canvases := []Canvas{}
	for rows.Next() {
		var cv Canvas
		if err := rows.Scan(&cv.ID, &cv.Name, &cv.ProjectType, &cv.CreatedAt, &cv.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		canvases = append(canvases, cv)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     canvases,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *Handler) CreateCanvas(c *gin.Context) {
	var body struct {
		Name        string `json:"name"`
		ProjectType string `json:"project_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pt := body.ProjectType
	if pt != "workflow" {
		pt = "canvas"
	}

	cv := Canvas{
		ID:          "cv_" + uuid.New().String()[:8],
		Name:        body.Name,
		ProjectType: pt,
	}
	_, err := h.db.Exec(`INSERT INTO canvases (id, name, project_type) VALUES (?, ?, ?)`, cv.ID, cv.Name, cv.ProjectType)
	if err != nil {
		h.log.Error("create canvas", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.log.Info("canvas created", "id", cv.ID, "type", cv.ProjectType)
	c.JSON(http.StatusCreated, cv)
}

func (h *Handler) GetCanvas(c *gin.Context) {
	id := c.Param("cid")
	cv := Canvas{}
	err := h.db.QueryRow(`SELECT id, name, project_type, created_at, updated_at FROM canvases WHERE id = ?`, id).
		Scan(&cv.ID, &cv.Name, &cv.ProjectType, &cv.CreatedAt, &cv.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "canvas not found"})
		return
	}
	if err != nil {
		h.log.Error("get canvas", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// load nodes
	rows, err := h.db.Query(`SELECT id, canvas_id, node_type, x, y, width, height, content, config, created_at, updated_at FROM nodes WHERE canvas_id = ?`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var n Node
			rows.Scan(&n.ID, &n.CanvasID, &n.NodeType, &n.X, &n.Y, &n.Width, &n.Height, &n.Content, &n.Config, &n.CreatedAt, &n.UpdatedAt)
			cv.Nodes = append(cv.Nodes, n)
		}
	}

	// load edges
	edgeRows, err := h.db.Query(`SELECT id, canvas_id, source_node_id, target_node_id, created_at FROM edges WHERE canvas_id = ?`, id)
	if err == nil {
		defer edgeRows.Close()
		for edgeRows.Next() {
			var e Edge
			edgeRows.Scan(&e.ID, &e.CanvasID, &e.SourceNodeID, &e.TargetNodeID, &e.CreatedAt)
			cv.Edges = append(cv.Edges, e)
		}
	}

	c.JSON(http.StatusOK, cv)
}

func (h *Handler) UpdateCanvas(c *gin.Context) {
	id := c.Param("cid")
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.db.Exec(`UPDATE canvases SET name = ?, updated_at = datetime('now','localtime') WHERE id = ?`, body.Name, id)
	if err != nil {
		h.log.Error("update canvas", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "name": body.Name})
}

func (h *Handler) DeleteCanvas(c *gin.Context) {
	id := c.Param("cid")
	_, err := h.db.Exec(`DELETE FROM canvases WHERE id = ?`, id)
	if err != nil {
		h.log.Error("delete canvas", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Node handlers ──────────────────────────────────────────────────

func (h *Handler) ListNodes(c *gin.Context) {
	cid := c.Param("cid")
	rows, err := h.db.Query(`SELECT id, canvas_id, node_type, x, y, width, height, content, config, created_at, updated_at FROM nodes WHERE canvas_id = ?`, cid)
	if err != nil {
		h.log.Error("list nodes", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	nodes := []Node{}
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.CanvasID, &n.NodeType, &n.X, &n.Y, &n.Width, &n.Height, &n.Content, &n.Config, &n.CreatedAt, &n.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		nodes = append(nodes, n)
	}
	c.JSON(http.StatusOK, nodes)
}

func (h *Handler) CreateNode(c *gin.Context) {
	cid := c.Param("cid")
	var n Node
	if err := c.ShouldBindJSON(&n); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	n.ID = "nd_" + uuid.New().String()[:8]
	n.CanvasID = cid
	if n.NodeType == "" {
		n.NodeType = "text"
	}
	if n.Width == 0 {
		n.Width = 280
	}
	if n.Height == 0 {
		n.Height = 200
	}
	if n.Config == "" {
		n.Config = "{}"
	}

	_, err := h.db.Exec(`INSERT INTO nodes (id, canvas_id, node_type, x, y, width, height, content, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		n.ID, n.CanvasID, n.NodeType, n.X, n.Y, n.Width, n.Height, n.Content, n.Config)
	if err != nil {
		h.log.Error("create node", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.log.Info("node created", "id", n.ID, "type", n.NodeType)
	c.JSON(http.StatusCreated, n)
}

func (h *Handler) UpdateNode(c *gin.Context) {
	cid := c.Param("cid")
	id := c.Param("id")
	var body struct {
		X       *float64 `json:"x"`
		Y       *float64 `json:"y"`
		Width   *float64 `json:"width"`
		Height  *float64 `json:"height"`
		Content *string  `json:"content"`
		Config  *string  `json:"config"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// fetch current
	var n Node
	err := h.db.QueryRow(`SELECT id, canvas_id, node_type, x, y, width, height, content, config, created_at, updated_at FROM nodes WHERE id = ? AND canvas_id = ?`, id, cid).
		Scan(&n.ID, &n.CanvasID, &n.NodeType, &n.X, &n.Y, &n.Width, &n.Height, &n.Content, &n.Config, &n.CreatedAt, &n.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "node not found"})
		return
	}
	if err != nil {
		h.log.Error("update node", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if body.X != nil {
		n.X = *body.X
	}
	if body.Y != nil {
		n.Y = *body.Y
	}
	if body.Width != nil {
		n.Width = *body.Width
	}
	if body.Height != nil {
		n.Height = *body.Height
	}
	if body.Content != nil {
		n.Content = *body.Content
	}
	if body.Config != nil {
		n.Config = *body.Config
	}

	_, err = h.db.Exec(`UPDATE nodes SET x=?, y=?, width=?, height=?, content=?, config=?, updated_at=datetime('now','localtime') WHERE id=? AND canvas_id=?`,
		n.X, n.Y, n.Width, n.Height, n.Content, n.Config, id, cid)
	if err != nil {
		h.log.Error("update node", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, n)
}

func (h *Handler) DeleteNode(c *gin.Context) {
	cid := c.Param("cid")
	id := c.Param("id")

	// delete related edges first (FK CASCADE may not work with all drivers)
	_, err := h.db.Exec(`DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?`, id, id)
	if err != nil {
		h.log.Error("delete node edges", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, err = h.db.Exec(`DELETE FROM nodes WHERE id = ? AND canvas_id = ?`, id, cid)
	if err != nil {
		h.log.Error("delete node", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
