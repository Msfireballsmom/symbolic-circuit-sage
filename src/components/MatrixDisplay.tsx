interface MatrixDisplayProps {
  G: number[][];
  I: number[];
  labels: string[];
}

const MatrixDisplay = ({ G, I, labels }: MatrixDisplayProps) => (
  <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border overflow-x-auto">
    <h4 className="text-sm font-semibold text-foreground mb-3">MNA Conductance Matrix [G][V] = [I]</h4>
    <div className="flex items-center gap-3 font-mono text-sm">
      {/* G matrix */}
      <div className="border-l-2 border-r-2 border-primary/50 px-2 py-1">
        {G.map((row, i) => (
          <div key={i} className="flex gap-4">
            {row.map((val, j) => (
              <span key={j} className="w-16 text-right text-equation">
                {val.toFixed(4)}
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* V vector */}
      <div className="border-l-2 border-r-2 border-accent/50 px-2 py-1">
        {labels.map((l, i) => (
          <div key={i} className="text-accent">{l}</div>
        ))}
      </div>
      <span className="text-muted-foreground">=</span>
      {/* I vector */}
      <div className="border-l-2 border-r-2 border-primary/50 px-2 py-1">
        {I.map((val, i) => (
          <div key={i} className="w-16 text-right text-equation">
            {val.toFixed(4)}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default MatrixDisplay;
