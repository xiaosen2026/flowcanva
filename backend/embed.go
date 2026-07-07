package main

import (
	"embed"
	_ "embed"
)

//go:embed admin-dist
var AdminEmbedFS embed.FS

//go:embed canvas-dist
var CanvasEmbedFS embed.FS

//go:embed seed.json
var EmbeddedSeedJSON []byte
