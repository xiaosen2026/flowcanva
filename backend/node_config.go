package main

type NodeConfig struct {
	ID             string `json:"id"`
	NodeType       string `json:"node_type"`
	ModelName      string `json:"model_name"`
	APIChannel     string `json:"api_channel"`
	BaseURL        string `json:"base_url"`
	APIKey         string `json:"api_key"`
	Parameters     string `json:"parameters"`
	PromptTemplate string `json:"prompt_template"`
	ExtraConfig    string `json:"extra_config"`
	Enabled        int    `json:"enabled"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}
