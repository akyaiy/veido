package main

import (
	"fmt"
	"os"
)

const (
	rows = 20
	cols = 28
	size = 25
)

func main() {
	out, err := os.Create("icons.svg")
	if err != nil {
		panic(err)
	}
	defer out.Close()

	width := cols * size
	height := rows * size

	// --- SVG header ---
	fmt.Fprintf(out, `<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="%d" height="%d"
     viewBox="0 0 %d %d">
`, width, height, width, height)

	// --- defs + symbols ---
	fmt.Fprintln(out, `<defs>`)

	for a := 1; a <= rows; a++ {
		for b := 1; b <= cols; b++ {
			id := fmt.Sprintf("%dx%d", a, b)

			fmt.Fprintf(out, `
<symbol id="%s" viewBox="0 0 20 20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
	<rect x="0" y="0" width="20" height="20" fill="none" stroke="black"/>
	<line x1="0" y1="0" x2="20" y2="20" stroke="black"/>
	<line x1="20" y1="0" x2="0" y2="20" stroke="black"/>
	<text x="10" y="12"
	      font-size="5"
	      text-anchor="middle"
	      fill="black">%s</text>
</symbol>
`, id, id)

		}
	}

	fmt.Fprintln(out, `</defs>`)

	// --- uses ---
	for a := 1; a <= rows; a++ {
		for b := 1; b <= cols; b++ {
			id := fmt.Sprintf("%dx%d", a, b)
			x := (b - 1) * size
			y := (a - 1) * size

			fmt.Fprintf(out,
				`<use xlink:href="#%s" x="%d" y="%d" width="20" height="20"/>`+"\n",
				id, x, y)
		}
	}

	fmt.Fprintln(out, `</svg>`)

	fmt.Println("icons.svg сгенерирован (Inkscape-совместим)")
}
