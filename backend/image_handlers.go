package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ImageGenRequest struct {
	Model       string `json:"model"`
	Prompt      string `json:"prompt"`
	N           int    `json:"n"`
	Size        string `json:"size"`
	AspectRatio string `json:"aspect_ratio"`
	ImageSize   string `json:"image_size"`
	Image       string `json:"image"`
	Path        string `json:"path"`
	Protocol    string `json:"protocol,omitempty"`
	Channel     string `json:"channel,omitempty"`
	BaseURL     string `json:"base_url,omitempty"`
	APIKey      string `json:"api_key,omitempty"`
}

// mapProtocol 将前端协议的语义值映射为实际 API 路径
func mapProtocol(p string) string {
	switch p {
	case "chat":
		return "/chat/completions"
	case "edit", "openai-edit":
		return "/images/edits"
	case "local", "openai-gen":
		return "/images/generations"
	default:
		return ""
	}
}

func (h *Handler) GenerateImage(c *gin.Context) {
	var req ImageGenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	apiKey := req.APIKey
	if apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_key 未配置，请在管理台节点配置中设置"})
		return
	}

	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	apiPath := req.Path
	if apiPath == "" {
		apiPath = "/images/generations"
	}
	// 优先用 protocol 显式指定,兼容旧 path 字段
	if p := mapProtocol(req.Protocol); p != "" {
		apiPath = p
	}

	var bodyBytes []byte
	if strings.Contains(apiPath, "/chat/") {
		bodyMap := map[string]interface{}{
			"model":    req.Model,
			"messages": []map[string]string{{"role": "user", "content": req.Prompt}},
			"n":        req.N,
		}
		if req.N <= 0 { bodyMap["n"] = 1 }
		bodyBytes, _ = json.Marshal(bodyMap)
	} else {
		bodyMap := map[string]interface{}{
			"model":  req.Model,
			"prompt": req.Prompt,
			"n":      req.N,
		}
		if req.N <= 0 { bodyMap["n"] = 1 }
		if req.Size != "" { bodyMap["size"] = req.Size
		} else if req.AspectRatio != "" {
			if s := computeSize(req.AspectRatio, req.ImageSize); s != "" { bodyMap["size"] = s }
		} else { bodyMap["size"] = "1024x1024" }
		if req.Image != "" { bodyMap["image"] = req.Image }
		if req.AspectRatio != "" { bodyMap["aspect_ratio"] = req.AspectRatio }
		if req.ImageSize != "" { bodyMap["image_size"] = req.ImageSize }
		bodyBytes, _ = json.Marshal(bodyMap)
	}

	httpReq, _ := http.NewRequest("POST", baseURL+apiPath, bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	bodyMap := map[string]interface{}{
		"model":  req.Model,
		"prompt": req.Prompt,
		"n":      req.N,
		"size":   req.Size,
	}
	if req.N <= 0 {
		bodyMap["n"] = 1
	}
	if req.Size == "" {
		bodyMap["size"] = "1024x1024"
	}
	if req.Image != "" {
		bodyMap["image"] = req.Image
	}
	if req.AspectRatio != "" {
		bodyMap["aspect_ratio"] = req.AspectRatio
	}
	if req.ImageSize != "" {
		bodyMap["image_size"] = req.ImageSize
	}
	// 计算 size (WxH) 格式：用于 chatgpt2api 等本地 API
	if req.Size == "" && req.AspectRatio != "" {
		size := computeSize(req.AspectRatio, req.ImageSize)
		if size != "" {
			bodyMap["size"] = size
		}
	}

	resp, err := llmClient.Do(httpReq)
	if err != nil {
		h.log.Error("image gen request failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		h.log.Error("image gen api error", "status", resp.StatusCode, "body", string(respBody))
	}
	c.Data(resp.StatusCode, "application/json", respBody)
}

func computeSize(ratio string, resolution string) string {
	type RatioPair struct{ w, h float64 }
	sizeMap := map[string]float64{"1K": 1024, "2K": 2048, "4K": 4096}
	ratioMap := map[string]RatioPair{
		"1:1":  {1, 1},
		"4:3":  {4, 3},
		"3:4":  {3, 4},
		"3:2":  {3, 2},
		"2:3":  {2, 3},
		"16:9": {16, 9},
		"9:16": {9, 16},
		"5:4":  {5, 4},
		"4:5":  {4, 5},
		"21:9": {21, 9},
	}
	base := sizeMap[resolution]
	if base == 0 {
		base = 1024
	}
	rp, ok := ratioMap[ratio]
	if !ok {
		rp = RatioPair{1, 1}
	}
	w := base * rp.w / rp.h
	h := base
	if rp.w < rp.h {
		w = base
		h = base * rp.h / rp.w
	}
	return fmt.Sprintf("%.0fx%.0f", w, h)
}
