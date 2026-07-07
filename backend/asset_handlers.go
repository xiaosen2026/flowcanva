package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) ListAssets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "24"))
	category := c.DefaultQuery("category", "")
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 24
	}
	offset := (page - 1) * pageSize

	whereClause := ""
	args := []any{}
	if category != "" {
		whereClause = " WHERE category = ?"
		args = append(args, category)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM assets" + whereClause
	if err := h.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		h.log.Error("list assets count", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	queryArgs := append(args, pageSize, offset)
	rows, err := h.db.Query(`SELECT id, filename, url, size, width, height, category, tags, created_at FROM assets`+whereClause+` ORDER BY created_at DESC LIMIT ? OFFSET ?`, queryArgs...)
	if err != nil {
		h.log.Error("list assets", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Asset struct {
		ID        string `json:"id"`
		Filename  string `json:"filename"`
		URL       string `json:"url"`
		Size      int64  `json:"size"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
		Category  string `json:"category"`
		Tags      string `json:"tags"`
		CreatedAt string `json:"created_at"`
	}

	items := []Asset{}
	for rows.Next() {
		var a Asset
		if err := rows.Scan(&a.ID, &a.Filename, &a.URL, &a.Size, &a.Width, &a.Height, &a.Category, &a.Tags, &a.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		items = append(items, a)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *Handler) UploadAsset(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded"})
		return
	}

	id := "ast_" + uuid.New().String()[:8]
	ext := filepath.Ext(file.Filename)
	savedName := id + ext
	savePath := filepath.Join("uploads", savedName)

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer src.Close()

	dst, err := os.Create(savePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	url := fmt.Sprintf("/uploads/%s", savedName)
	_, err = h.db.Exec(`INSERT INTO assets (id, filename, url, size) VALUES (?, ?, ?, ?)`,
		id, file.Filename, url, file.Size)
	if err != nil {
		h.log.Error("upload asset", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.log.Info("asset uploaded", "id", id, "filename", file.Filename)
	c.JSON(http.StatusCreated, gin.H{
		"id":       id,
		"filename": file.Filename,
		"url":      url,
		"size":     file.Size,
			"category": "其他",
			"tags":     "[]",
	})
}

func (h *Handler) DeleteAsset(c *gin.Context) {
	id := c.Param("id")

	// get url to delete file
	var url string
	h.db.QueryRow(`SELECT url FROM assets WHERE id = ?`, id).Scan(&url)

	_, err := h.db.Exec(`DELETE FROM assets WHERE id = ?`, id)
	if err != nil {
		h.log.Error("delete asset", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// try to delete file
	if url != "" {
		os.Remove("." + url)
	}

	c.Status(http.StatusNoContent)
}

// UpdateAsset modifies category/tags of an existing asset
func (h *Handler) UpdateAsset(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Category *string `json:"category"`
		Tags     *string `json:"tags"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.Category != nil {
		if _, err := h.db.Exec(`UPDATE assets SET category = ? WHERE id = ?`, *body.Category, id); err != nil {
			h.log.Error("update asset category", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if body.Tags != nil {
		if _, err := h.db.Exec(`UPDATE assets SET tags = ? WHERE id = ?`, *body.Tags, id); err != nil {
			h.log.Error("update asset tags", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.Status(http.StatusNoContent)
}
