package timeconverter

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Duration — тип, совместимый с time.Duration, но поддерживающий дни и строковый ввод.
type Duration time.Duration

// regex для парсинга (d, h, m, s, ms, us, ns)
var durationPart = regexp.MustCompile(`(?i)(\d+)(d|h|m|s|ms|us|µs|ns)`)

// multiplier таблица
var units = map[string]time.Duration{
	"d":  time.Hour * 24,
	"h":  time.Hour,
	"m":  time.Minute,
	"s":  time.Second,
	"ms": time.Millisecond,
	"us": time.Microsecond,
	"µs": time.Microsecond,
	"ns": time.Nanosecond,
}

// Parse — преобразует строку ("15m", "2h", "1d6h") в Duration.
func Parse(s string) (Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, errors.New("empty duration string")
	}

	matches := durationPart.FindAllStringSubmatch(s, -1)
	if matches == nil {
		return 0, fmt.Errorf("invalid duration: %s", s)
	}

	var total time.Duration

	for _, m := range matches {
		valueStr := m[1]
		unit := strings.ToLower(m[2])

		value, err := strconv.Atoi(valueStr)
		if err != nil {
			return 0, fmt.Errorf("invalid number '%s' in duration", valueStr)
		}

		mult, ok := units[unit]
		if !ok {
			return 0, fmt.Errorf("invalid unit '%s' in duration", unit)
		}

		total += time.Duration(value) * mult
	}

	return Duration(total), nil
}

// MustParse — паника при ошибке.
func MustParse(s string) Duration {
	d, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return d
}

// ToDuration — преобразование в time.Duration.
func (d Duration) ToDuration() time.Duration {
	return time.Duration(d)
}

// String — вывод в человекочитаемом формате.
func (d Duration) String() string {
	return formatDuration(time.Duration(d))
}

// форматирование обратно в строку (1d6h30m...)
func formatDuration(d time.Duration) string {
	if d == 0 {
		return "0s"
	}

	var b strings.Builder

	parts := []struct {
		unit string
		dur  time.Duration
	}{
		{"d", 24 * time.Hour},
		{"h", time.Hour},
		{"m", time.Minute},
		{"s", time.Second},
		{"ms", time.Millisecond},
		{"us", time.Microsecond},
		{"ns", time.Nanosecond},
	}

	for _, p := range parts {
		if d >= p.dur {
			v := d / p.dur
			d -= v * p.dur
			fmt.Fprintf(&b, "%d%s", v, p.unit)
		}
	}

	return b.String()
}

// JSON: Marshal
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// JSON: Unmarshal ("15m" или число наносекунд)
func (d *Duration) UnmarshalJSON(data []byte) error {
	// строка?
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		dd, err := Parse(s)
		if err != nil {
			return err
		}
		*d = dd
		return nil
	}

	// число?
	var ns int64
	if err := json.Unmarshal(data, &ns); err == nil {
		*d = Duration(time.Duration(ns))
		return nil
	}

	return fmt.Errorf("invalid duration JSON: %s", string(data))
}

// TextMarshaler
func (d Duration) MarshalText() ([]byte, error) {
	return []byte(d.String()), nil
}

// TextUnmarshaler
func (d *Duration) UnmarshalText(text []byte) error {
	dd, err := Parse(string(text))
	if err != nil {
		return err
	}
	*d = dd
	return nil
}
