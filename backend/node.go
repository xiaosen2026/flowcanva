package main

type Node struct {
	ID        string  `json:"id"`
	CanvasID  string  `json:"canvas_id"`
	NodeType  string  `json:"node_type"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
	Content   string  `json:"content"`
	Config    string  `json:"config"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}
