package main

type Canvas struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ProjectType string `json:"project_type"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	Nodes       []Node `json:"nodes,omitempty"`
	Edges       []Edge `json:"edges,omitempty"`
}
