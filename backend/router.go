package main

import (
	"embed"
	"log/slog"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

func setupRouter(h *Handler, cfg Config) *gin.Engine {
	// 注册 3D 模型等扩展名的 MIME,避免浏览器/GLTFLoader 收到 application/octet-stream
	mime.AddExtensionType(".glb", "model/gltf-binary")
	mime.AddExtensionType(".gltf", "model/gltf+json")
	r := gin.New()
	r.Use(CORSMiddleware())
	r.Use(LoggerMiddleware(h.log))

	api := r.Group("/api")
	{
		api.GET("/canvases", h.ListCanvases)
		api.POST("/canvases", h.CreateCanvas)
		api.GET("/canvases/:cid", h.GetCanvas)
		api.PUT("/canvases/:cid", h.UpdateCanvas)
		api.DELETE("/canvases/:cid", h.DeleteCanvas)

		api.GET("/canvases/:cid/nodes", h.ListNodes)
		api.POST("/canvases/:cid/nodes", h.CreateNode)
		api.PUT("/canvases/:cid/nodes/:id", h.UpdateNode)
		api.DELETE("/canvases/:cid/nodes/:id", h.DeleteNode)

		api.GET("/canvases/:cid/edges", h.ListEdges)
		api.POST("/canvases/:cid/edges", h.CreateEdge)
		api.DELETE("/canvases/:cid/edges/:id", h.DeleteEdge)

		api.POST("/llm/chat", h.ChatWithLLM)

		api.POST("/images/generate", h.GenerateImage)

		api.POST("/video/generate", h.GenerateVideo)

		api.POST("/upload-image-host", h.UploadToImageHost)

		api.POST("/comfyui/execute", h.ExecuteComfyUI)
		api.GET("/comfyui/result/:prompt_id", h.GetComfyUIResult)
		api.GET("/comfyui/proxy-view", h.ProxyComfyUIImage)
	}

	admin := r.Group("/api/admin")
	{
		admin.GET("/node-configs", h.ListNodeConfigs)
		admin.GET("/node-configs/:type", h.GetNodeConfig)
		admin.PUT("/node-configs/:type", h.UpdateNodeConfig)

		admin.GET("/logs", h.ListLogs)

		admin.GET("/assets", h.ListAssets)
		admin.POST("/assets/upload", h.UploadAsset)
		admin.PUT("/assets/:id", h.UpdateAsset)
		admin.DELETE("/assets/:id", h.DeleteAsset)

		admin.GET("/presets", h.ListPresets)
		admin.POST("/presets", h.CreatePreset)
		admin.PUT("/presets/:id", h.UpdatePreset)
		admin.DELETE("/presets/:id", h.DeletePreset)
	}

	r.Static("/uploads", "./uploads")

	if cfg.DevMode {
		adminURL, _ := url.Parse(cfg.AdminDevURL)
		canvasURL, _ := url.Parse(cfg.CanvasDevURL)
		adminProxy := httputil.NewSingleHostReverseProxy(adminURL)
		canvasProxy := httputil.NewSingleHostReverseProxy(canvasURL)

		r.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/canvas") {
				canvasProxy.ServeHTTP(c.Writer, c.Request)
				return
			}
			adminProxy.ServeHTTP(c.Writer, c.Request)
		})
	}

	if !cfg.DevMode {
		if cfg.Embedded {
			// embedded SPA: serve every static file via embed.FS.ReadFile,
			// bypass http.FileServer which has directory/redirect issues in Go 1.25
			r.GET("/assets/*filepath", func(c *gin.Context) {
				serveEmbed(c, AdminEmbedFS, "admin-dist/assets/"+c.Param("filepath"))
			})
			r.GET("/canvas/assets/*filepath", func(c *gin.Context) {
				serveEmbed(c, CanvasEmbedFS, "canvas-dist/assets/"+c.Param("filepath"))
			})
			// canvas 下的其他静态资源(3D 模型等,来自 public/)
			r.GET("/canvas/models/*filepath", func(c *gin.Context) {
				serveEmbed(c, CanvasEmbedFS, "canvas-dist/models/"+c.Param("filepath"))
			})
			r.GET("/favicon.ico", func(c *gin.Context) {
				serveEmbed(c, AdminEmbedFS, "admin-dist/favicon.ico")
			})
			r.GET("/canvas", func(c *gin.Context) {
				serveEmbedHTML(c, CanvasEmbedFS, "canvas-dist/index.html")
			})

		r.NoRoute(func(c *gin.Context) {
				path := c.Request.URL.Path
				if strings.HasPrefix(path, "/canvas") {
					// 先尝试 canvas-dist 下的实际文件(模型/图片等),读不到再回退 SPA index.html
					serveEmbed(c, CanvasEmbedFS, "canvas-dist"+path)
					if !c.Writer.Written() {
						serveEmbedHTML(c, CanvasEmbedFS, "canvas-dist/index.html")
					}
					return
				}
				// admin SPA: try file first, fallback to index.html
				serveEmbed(c, AdminEmbedFS, "admin-dist"+path)
				if !c.Writer.Written() {
					serveEmbedHTML(c, AdminEmbedFS, "admin-dist/index.html")
				}
			})
		} else {
			consoleDist := cfg.ConsoleDir
			canvasDist := cfg.CanvasDir

			r.Static("/assets", consoleDist+"/assets")
			r.StaticFile("/favicon.ico", consoleDist+"/favicon.ico")

			r.GET("/canvas", func(c *gin.Context) {
				c.File(canvasDist + "/index.html")
			})

			r.Static("/canvas/assets", canvasDist+"/assets")
			r.Static("/canvas/models", canvasDist+"/models")

			r.NoRoute(func(c *gin.Context) {
				path := c.Request.URL.Path
				if strings.HasPrefix(path, "/canvas") {
					c.File(canvasDist + "/index.html")
					return
				}
				c.File(consoleDist + "/index.html")
			})
		}
	}

	slog.Info("routes registered")
	return r
}

func serveEmbed(c *gin.Context, efs embed.FS, fp string) {
	fp = path.Clean(fp)
	data, err := efs.ReadFile(fp)
	if err != nil {
		return
	}
	ct := mime.TypeByExtension(path.Ext(fp))
	if ct == "" {
		ct = "application/octet-stream"
	}
	c.Data(http.StatusOK, ct, data)
}

func serveEmbedHTML(c *gin.Context, efs embed.FS, fp string) {
	fp = path.Clean(fp)
	data, err := efs.ReadFile(fp)
	if err != nil {
		slog.Warn("serveEmbedHTML not found", "path", fp, "error", err)
		c.Status(http.StatusNotFound)
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}
