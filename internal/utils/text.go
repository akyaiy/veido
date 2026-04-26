package utils

func IsASCIIAlphaNumeric(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]

		if (c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') ||
			c == '_' || c == '-' || c == '.' || c == '*' || c == '!' {
			continue
		}

		return false
	}
	return true
}