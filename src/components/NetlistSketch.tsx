export interface SketchEdge {
  label: string;
  nodeA: number;
  nodeB: number;
}

export interface SketchNode {
  node: number;
  x: number;
  y: number;
}

/** Straight-line netlist drawing. Node 0 is ground when no positions are supplied. */
export default function NetlistSketch({
  edges,
  positions,
  caption,
}: {
  edges: SketchEdge[];
  positions?: SketchNode[];
  caption: string;
}) {
  const ids = [...new Set(edges.flatMap(edge => [edge.nodeA, edge.nodeB]))];
  const placed = new Map<number, { x: number; y: number }>();
  if (positions) {
    for (const position of positions) placed.set(position.node, { x: position.x, y: position.y });
  }
  const floating = ids.filter(id => !placed.has(id) && id !== 0);
  floating.forEach((id, index) => placed.set(id, { x: 36 + index * 78, y: 36 }));
  if (!placed.has(0) && ids.includes(0)) {
    const xs = [...placed.values()].map(point => point.x);
    const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 120;
    placed.set(0, { x: mid, y: 168 });
  }
  const points = [...placed.values()];
  const minX = Math.min(...points.map(point => point.x), 0) - 28;
  const minY = Math.min(...points.map(point => point.y), 0) - 16;
  const maxX = Math.max(...points.map(point => point.x), 40) + 36;
  const maxY = Math.max(...points.map(point => point.y), 40) + 24;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <figure className="p-4 rounded-lg bg-card border border-border">
      <figcaption className="text-xs text-muted-foreground mb-2">{caption}</figcaption>
      <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="w-full max-w-xl">
        {edges.map((edge, index) => {
          const a = placed.get(edge.nodeA);
          const b = placed.get(edge.nodeB);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={`${edge.label}-${index}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-primary" strokeWidth="1.5" />
              <text x={mx + 4} y={my - 4} className="fill-foreground text-[9px] font-mono">{edge.label}</text>
            </g>
          );
        })}
        {[...placed.entries()].map(([node, point]) => (
          <g key={node}>
            <circle cx={point.x} cy={point.y} r={node === 0 ? 5 : 3.5} className={node === 0 ? 'fill-muted-foreground' : 'fill-primary'} />
            <text x={point.x + 6} y={point.y + 12} className="fill-muted-foreground text-[8px] font-mono">{node === 0 ? '0' : node}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
