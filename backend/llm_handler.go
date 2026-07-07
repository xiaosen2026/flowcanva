package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var llmClient = &http.Client{Timeout: 120 * time.Second}
var pollClient = &http.Client{Timeout: 30 * time.Second}

type ChatRequest struct {
	Model      string        `json:"model"`
	Messages   []ChatMessage `json:"messages"`
	Stream     bool          `json:"stream"`
	Channel    string        `json:"channel,omitempty"`
	BaseURL    string        `json:"base_url,omitempty"`
	APIKey     string        `json:"api_key,omitempty"`
	Parameters any           `json:"parameters,omitempty"`
}

type ChatMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

func (h *Handler) ChatWithLLM(c *gin.Context) {
	var req ChatRequest
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

	if req.Stream {
		h.streamChat(c, req, apiKey, baseURL)
	} else {
		h.normalChat(c, req, apiKey, baseURL)
	}
}

func (h *Handler) normalChat(c *gin.Context, req ChatRequest, apiKey, baseURL string) {
	h.log.Info("llm chat request", "model", req.Model, "messages", len(req.Messages))

	bodyMap := map[string]interface{}{
		"model":    req.Model,
		"messages": req.Messages,
	}
	if req.Parameters != nil {
		bodyMap["parameters"] = req.Parameters
	}

	bodyBytes, _ := json.Marshal(bodyMap)

	httpReq, _ := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := llmClient.Do(httpReq)
	if err != nil {
		h.log.Error("llm request failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		h.log.Error("llm api error", "status", resp.StatusCode, "body", string(respBody))
	}
	c.Data(resp.StatusCode, "application/json", respBody)
}

func (h *Handler) streamChat(c *gin.Context, req ChatRequest, apiKey, baseURL string) {
	req.Stream = true

	h.log.Info("llm stream chat request", "model", req.Model, "messages", len(req.Messages))

	bodyMap := map[string]interface{}{
		"model":    req.Model,
		"messages": req.Messages,
		"stream":   true,
	}
	if req.Parameters != nil {
		bodyMap["parameters"] = req.Parameters
	}

	bodyBytes, _ := json.Marshal(bodyMap)

	httpReq, _ := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := llmClient.Do(httpReq)
	if err != nil {
		h.log.Error("llm stream request failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		h.log.Error("llm stream api error", "status", resp.StatusCode, "body", string(body))
		c.Data(resp.StatusCode, "application/json", body)
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err != io.EOF {
				h.log.Error("stream read error", "error", err)
			}
			break
		}

		line = strings.TrimRight(line, "\r\n")

		if strings.HasPrefix(line, "data:") {
			c.Writer.WriteString(line + "\n\n")
			c.Writer.Flush()

			if strings.Contains(line, "[DONE]") {
				break
			}
		}
	}
}
