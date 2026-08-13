package local

type AccountStats struct {
	Files         int64 `json:"files"`
	Directories   int64 `json:"directories"`
	LogicalBytes  int64 `json:"logical_bytes"`
	PhysicalBytes int64 `json:"physical_bytes"`
}
