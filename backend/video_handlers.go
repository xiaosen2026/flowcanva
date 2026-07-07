package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type VideoGenRequest struct {
	Model      string   `json:"model"`
	Prompt     string   `json:"prompt"`
	Seconds    string   `json:"seconds"`
	Ratio      string   `json:"ratio"`
	Resolution string   `json:"resolution"`
	ImageURL   string   `json:"image_url,omitempty"`
	ImageURLs  []string `json:"image_urls,omitempty"`
	VideoURLs  []string `json:"video_urls,omitempty"`
	AudioURLs  []string `json:"audio_urls,omitempty"`
	Count      int      `json:"n"`
	Channel    string   `json:"channel,omitempty"`
	BaseURL    string   `json:"base_url,omitempty"`
	APIKey     string   `json:"api_key,omitempty"`
}

type VideoGenResponse struct {
	Videos []string `json:"videos"`
	Items  []struct {
		Index    int    `json:"index"`
		TaskID   string `json:"task_id"`
		VideoURL string `json:"video_url"`
	} `json:"items"`
}

func (h *Handler) GenerateVideo(c *gin.Context) {
	var req VideoGenRequest
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
	if baseURL == "" {		baseURL = "https://api.nxfl.cc"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	if req.Model == "" {
		req.Model = "doubao-seedance-2-0-260128"
	}
	if req.Seconds == "" {
		req.Seconds = "10"
	}
	if req.Ratio == "" {
		req.Ratio = "9:16"
	}
	if req.Resolution == "" {
		req.Resolution = "720p"
	}

	var imageList []string
	if req.ImageURL != "" {
		imageList = []string{req.ImageURL}
	} else if len(req.ImageURLs) > 0 {
		imageList = req.ImageURLs
	}

	payload := map[string]interface{}{
		"model":   req.Model,
		"prompt":  req.Prompt,
		"seconds": req.Seconds,
		"metadata": map[string]interface{}{
			"resolution": req.Resolution,
			"ratio":      req.Ratio,
		},
	}
	if len(imageList) > 0 {
		payload["images"] = imageList
		contentArr := make([]map[string]interface{}, len(imageList))
		for i, url := range imageList {
			contentArr[i] = map[string]interface{}{
				"type":      "image_url",
				"image_url": map[string]string{"url": url},
				"role":      "reference_image",
			}
		}
		if vidList := req.VideoURLs; len(vidList) > 0 {
			for _, url := range vidList {
				contentArr = append(contentArr, map[string]interface{}{
					"type":      "video_url",
					"video_url": map[string]string{"url": url},
					"role":      "reference_video",
				})
			}
		}
		if audList := req.AudioURLs; len(audList) > 0 {
			for _, url := range audList {
				contentArr = append(contentArr, map[string]interface{}{
					"type":      "audio_url",
					"audio_url": map[string]string{"url": url},
					"role":      "reference_audio",
				})
			}
		}
		payload["metadata"].(map[string]interface{})["content"] = contentArr
	}

	createURL := baseURL + "/v1/video/generations"
	bodyBytes, _ := json.Marshal(payload)

	httpReq, _ := http.NewRequest("POST", createURL, bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := llmClient.Do(httpReq)
	if err != nil {
		h.log.Error("video create failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		h.log.Error("video create api error", "status", resp.StatusCode, "body", string(respBody))
		c.Data(resp.StatusCode, "application/json", respBody)
		return
	}

	var createData map[string]interface{}
	json.Unmarshal(respBody, &createData)

	taskID := ""
	for _, key := range []string{"id", "task_id", "video_id"} {
		if v, ok := createData[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				taskID = s
				break
			}
		}
	}

	if taskID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "未找到 task_id"})
		return
	}

	// 轮询
	pollURL := baseURL + "/v1/video/generations/" + taskID
	maxWait := 600 * time.Second
	pollInterval := 5 * time.Second
	deadline := time.Now().Add(maxWait)

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)

		httpReq, _ := http.NewRequest("GET", pollURL, nil)
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := pollClient.Do(httpReq)
		if err != nil {
			continue
		}
		pollBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode >= 400 {
			continue
		}

		var pollData map[string]interface{}
		json.Unmarshal(pollBody, &pollData)

		status := extractStatus(pollData)
		videoURL := findVideoURL(pollData)

		if videoURL != "" && (status == "" || status == "completed" || status == "succeeded" || status == "success" || status == "done" || status == "finished") {
			localURL := videoURL
			dlResp, dlErr := llmClient.Get(videoURL)
			if dlErr == nil && dlResp.StatusCode == 200 {
				defer dlResp.Body.Close()
				os.MkdirAll("./uploads/videos", 0755)
				filename := fmt.Sprintf("video_%d.mp4", time.Now().Unix())
				localPath := fmt.Sprintf("./uploads/videos/%s", filename)
				f, err := os.Create(localPath)
				if err == nil {
					written, copyErr := io.Copy(f, dlResp.Body)
					f.Close()
					if copyErr == nil && written > 10000 {
						localURL = "/uploads/videos/" + filename
						h.log.Info("video saved", "path", localPath, "bytes", written)
					}
				}
			}

			c.JSON(http.StatusOK, gin.H{
				"videos": []string{localURL},
				"items": []map[string]interface{}{
					{"index": 0, "task_id": taskID, "video_url": localURL},
				},
			})
			return
		}

		if status == "failed" || status == "failure" || status == "error" || status == "cancelled" || status == "canceled" || status == "expired" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("视频任务失败: %s", status), "poll_data": pollData})
			return
		}
	}

	c.JSON(http.StatusRequestTimeout, gin.H{"error": "视频任务超时"})
}

func extractStatus(data interface{}) string {
	if d, ok := data.(map[string]interface{}); ok {
		for _, key := range []string{"status", "state", "task_status", "phase"} {
			if v, ok := d[key]; ok {
				if s, ok := v.(string); ok && s != "" {
					return strings.ToLower(s)
				}
			}
		}
		for _, key := range []string{"data", "result", "task", "response", "output"} {
			if nested, ok := d[key]; ok {
				if s := extractStatus(nested); s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func findVideoURL(data interface{}) string {
	switch d := data.(type) {
	case string:
		if strings.HasPrefix(d, "http://") || strings.HasPrefix(d, "https://") {
			return d
		}
		if strings.HasSuffix(d, ".mp4") || strings.HasSuffix(d, ".webm") || strings.HasSuffix(d, ".mov") {
			return d
		}
	case []interface{}:
		for _, item := range d {
			if u := findVideoURL(item); u != "" {
				return u
			}
		}
	case map[string]interface{}:
		preferred := []string{"video_url", "video", "url", "output_url", "download_url", "file_url", "source_url"}
		for _, key := range preferred {
			if v, ok := d[key]; ok {
				if u := findVideoURL(v); u != "" {
					return u
				}
			}
		}
		for _, v := range d {
			if u := findVideoURL(v); u != "" {
				return u
			}
		}
	}
	return ""
}

func (h *Handler) UploadToImageHost(c *gin.Context) {
	var body struct {
		DataURL string `json:"data_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b64 := strings.TrimPrefix(body.DataURL, "data:image/png;base64,")
	b64 = strings.TrimPrefix(b64, "data:image/jpeg;base64,")
	b64 = strings.TrimPrefix(b64, "data:image/webp;base64,")
	buf, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid base64"})
		return
	}
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	part, _ := w.CreateFormFile("file", "comfyui.jpg")
	part.Write(buf)
	w.Close()
	req, _ := http.NewRequest("POST", "https://img.remit.ee/api/upload", &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Referer", "https://img.remit.ee/free-image-hosting")
	req.Header.Set("Origin", "https://img.remit.ee")
	req.Header.Set("Accept", "application/json")
	resp, err := llmClient.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result struct {
		Success bool   `json:"success"`
		URL     string `json:"url"`
		Message string `json:"message"`
	}
	json.Unmarshal(respBody, &result)
	if !result.Success {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed", "detail": result.Message})
		return
	}
	fullURL := result.URL
	if strings.HasPrefix(fullURL, "/") {
		fullURL = "https://img.remit.ee" + fullURL
	}
	c.JSON(http.StatusOK, gin.H{"url": fullURL})
}
