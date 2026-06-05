<svg width="600" height="400">
    <g id="background">
        <rect x="20" y="20" width="560" height="360" fill="#ffffff" stroke="#cccccc" />
    </g>
    <g id="grid">
        <line x1="100" y1="20" x2="100" y2="380" stroke="#e0e0e0" />
        <line x1="200" y1="20" x2="200" y2="380" stroke="#e0e0e0" />
        <line x1="300" y1="20" x2="300" y2="380" stroke="#e0e0e0" />
        <line x1="400" y1="20" x2="400" y2="380" stroke="#e0e0e0" />
        <line x1="500" y1="20" x2="500" y2="380" stroke="#e0e0e0" />
        <line x1="20" y1="100" x2="580" y2="100" stroke="#e0e0e0" />
        <line x1="20" y1="200" x2="580" y2="200" stroke="#e0e0e0" />
        <line x1="20" y1="300" x2="580" y2="300" stroke="#e0e0e0" />
    </g>
    <g id="rectangles">
        <rect x="50" y="50" width="120" height="80" fill="red" />
        <rect x="90" y="80" width="120" height="80" fill="orange" opacity="0.7" />
        <rect x="130" y="110" width="120" height="80" fill="yellow" opacity="0.7" />
    </g>
    <g id="circles">
        <circle cx="350" cy="90" r="40" fill="blue" />
        <circle cx="400" cy="120" r="40" fill="cyan" opacity="0.7" />
        <circle cx="450" cy="90" r="40" fill="purple" opacity="0.7" />
    </g>
    <g id="lines">
        <line x1="50" y1="250" x2="250" y2="320" stroke="black" stroke-width="3" />
        <line x1="50" y1="320" x2="250" y2="250" stroke="black" stroke-width="3" />
        <line x1="150" y1="220" x2="150" y2="350" stroke="black" stroke-width="2" />
    </g>
    <g id="paths">
        <path d="M300 250 Q400 150 500 250" fill="none" stroke="green" stroke-width="4" />
        <path d="M300 280 C350 180 450 380 500 280" fill="none" stroke="darkgreen" stroke-width="4" />
    </g>
    <g id="polygons">
        <polygon points="520,180 560,250 480,250" fill="pink" />
        <polygon points="520,270 560,340 480,340" fill="brown" />
    </g>
    <g id="nested-group-1">
        <g id="nested-group-2">
            <rect x="40" y="340" width="60" height="30" fill="navy" />
            <circle cx="140" cy="355" r="15" fill="lime" />
            <path d="M180 370 L220 340 L260 370 Z" fill="magenta" />
        </g>
    </g>
</svg>