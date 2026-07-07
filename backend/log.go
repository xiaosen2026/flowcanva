package main

type LogEntry struct {
	ID        string `json:"id"`
	Level     string `json:"level"`
	Module    string `json:"module"`
	Message   string `json:"message"`
	Detail    string `json:"detail"`
	CreatedAt string `json:"created_at"`
}
