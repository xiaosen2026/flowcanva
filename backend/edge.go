package main

type Edge struct {
	ID           string `json:"id"`
	CanvasID     string `json:"canvas_id"`
	SourceNodeID string `json:"source_node_id"`
	TargetNodeID string `json:"target_node_id"`
	CreatedAt    string `json:"created_at"`
}
