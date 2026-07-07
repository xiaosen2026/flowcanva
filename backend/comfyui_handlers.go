package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type comfyExecuteRequest struct {
	ServerURL    string          `json:"server_url"`
	WorkflowJSON json.RawMessage `json:"workflow_json"`
}

type comfyPromptResponse struct {
	PromptID string          `json:"prompt_id"`
	Error    json.RawMessage `json:"error,omitempty"`
}

type comfyResultRequest struct {
	ServerURL string `form:"server_url"`
}

func (h *Handler) ExecuteComfyUI(c *gin.Context) {
	var req comfyExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ServerURL == "" {
		req.ServerURL = "http://localhost:8188"
	}

	// Remove leading "api/" from workflow if it's a full API workflow
	var workflowJSON json.RawMessage
	workflowJSON = req.WorkflowJSON

	// POST to ComfyUI prompt endpoint
	body := map[string]interface{}{
		"prompt": workflowJSON,
	}
	jsonBody, _ := json.Marshal(body)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(
		fmt.Sprintf("%s/prompt", req.ServerURL),
		"application/json",
		bytes.NewReader(jsonBody),
	)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("无法连接ComfyUI: %v", err)})
		return
	}
	defer resp.Body.Close()

	var promptResp comfyPromptResponse
	if err := json.NewDecoder(resp.Body).Decode(&promptResp); err != nil {
		respBody, _ := io.ReadAll(resp.Body)
		h.log.Error("comfyui execute parse error", "body", string(respBody))
		c.JSON(http.StatusBadGateway, gin.H{"error": "无法解析ComfyUI响应"})
		return
	}

	if promptResp.Error != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": string(promptResp.Error)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"prompt_id": promptResp.PromptID})
}

func (h *Handler) GetComfyUIResult(c *gin.Context) {
	promptID := c.Param("prompt_id")
	serverURL := c.Query("server_url")
	if serverURL == "" {
		serverURL = "http://localhost:8188"
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/history/%s", serverURL, promptID))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("无法连接ComfyUI: %v", err)})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	// Return raw response for frontend to parse
	var historyData map[string]interface{}
	if err := json.Unmarshal(body, &historyData); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "无法解析ComfyUI历史数据"})
		return
	}

	// Extract outputs (images + text)
	outputs := []map[string]string{}
	if promptData, ok := historyData[promptID]; ok {
		if dataMap, ok := promptData.(map[string]interface{}); ok {
			if outputsData, ok := dataMap["outputs"]; ok {
				if outputsMap, ok := outputsData.(map[string]interface{}); ok {
					for nodeID, nodeOutput := range outputsMap {
						if nodeMap, ok := nodeOutput.(map[string]interface{}); ok {
							// Images
							if images, ok := nodeMap["images"]; ok {
								if imgList, ok := images.([]interface{}); ok {
									for _, img := range imgList {
										if imgMap, ok := img.(map[string]interface{}); ok {
											filename, _ := imgMap["filename"].(string)
											subfolder, _ := imgMap["subfolder"].(string)
											imgType, _ := imgMap["type"].(string)
											outputs = append(outputs, map[string]string{
												"url":       fmt.Sprintf("%s/view?filename=%s&subfolder=%s&type=%s", serverURL, filename, subfolder, imgType),
												"node_id":   nodeID,
												"filename":  filename,
												"kind":      "image",
											})
										}
									}
								}
							}
							// Text
							if texts, ok := nodeMap["text"]; ok {
								if textList, ok := texts.([]interface{}); ok {
									for _, t := range textList {
										outputs = append(outputs, map[string]string{
											"value":   fmt.Sprintf("%v", t),
											"node_id": nodeID,
											"kind":    "text",
										})
									}
								}
							}
							// Gifs/video
							if gifs, ok := nodeMap["gifs"]; ok {
								if gifList, ok := gifs.([]interface{}); ok {
									for _, g := range gifList {
										if gifMap, ok := g.(map[string]interface{}); ok {
											filename, _ := gifMap["filename"].(string)
											subfolder, _ := gifMap["subfolder"].(string)
											format, _ := gifMap["format"].(string)
											outputs = append(outputs, map[string]string{
												"url":       fmt.Sprintf("%s/view?filename=%s&subfolder=%s&type=output&format=%s", serverURL, filename, subfolder, format),
												"node_id":   nodeID,
												"filename":  filename,
												"kind":      "gif",
											})
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"outputs": outputs,
		"raw":     historyData,
	})
}

func (h *Handler) ProxyComfyUIImage(c *gin.Context) {
	url := c.Query("url")
	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少url参数"})
		return
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("获取图片失败: %v", err)})
		return
	}
	defer resp.Body.Close()
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	c.DataFromReader(http.StatusOK, resp.ContentLength, ct, resp.Body, nil)
}
