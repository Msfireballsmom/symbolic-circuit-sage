import { useState } from "react";
import { CheckCircle, AlertTriangle, ChevronRight, ChevronDown, Copy, Check, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportSolutionAsPDF } from "@/lib/pdf-export";

interface StepDisplayProps {
  steps: string[];
  defaultExpanded?: boolean;
  title?: string;
  results?: { label: string; value: string }[];
  verification?: 'verified' | 'unverified';
}

const StepDisplay = ({ steps, defaultExpanded = true, title, results, verification = 'unverified' }: StepDisplayProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const [copyError, setCopyError] = useState('');
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${verification === 'verified' ? 'Verified' : 'Unverified'} — Circuit Sage\n${steps.join('\n')}`);
      setCopyError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError('Copy failed: clipboard access was denied.'); }
  };

  // Group steps into sections by detecting headers (lines with ═ or STEP or all-caps)
  const sections: { title: string; steps: string[] }[] = [];
  let currentSection: { title: string; steps: string[] } = { title: '', steps: [] };

  steps.forEach((step) => {
    if (step.match(/^(STEP \d|═{3,}|FINAL|───)/)) {
      if (currentSection.steps.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = { title: step, steps: [] };
    } else {
      currentSection.steps.push(step);
    }
  });
  if (currentSection.steps.length > 0 || currentSection.title) {
    sections.push(currentSection);
  }

  const hasSections = sections.some(s => s.title.match(/^(STEP \d|═{3,})/));

  const renderStep = (step: string, i: number) => {
    const isSuccess = step.startsWith('✓');
    const isWarning = step.startsWith('⚠');
    const isHeader = step.match(/^(═{3,})/);
    const isSectionTitle = step.match(/^(STEP \d|FINAL)/);
    const isEmpty = step.trim() === '';

    if (isEmpty) return <div key={i} className="h-1.5" />;
    if (isHeader) return (
      <div key={i} className="font-mono text-xs text-primary/50 select-none">{step}</div>
    );

    return (
      <div
        key={i}
        className={`flex items-start gap-2 text-sm font-mono animate-slide-up ${isSectionTitle ? 'mt-2 mb-1' : ''}`}
        style={{ animationDelay: `${i * 30}ms` }}
      >
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
        ) : isWarning ? (
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        ) : isSectionTitle ? (
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[9px] text-primary font-bold mt-0.5 flex-shrink-0">
            {step.match(/\d+/)?.[0] || '→'}
          </div>
        ) : (
          <ChevronRight className="w-4 h-4 text-primary/40 mt-0.5 flex-shrink-0" />
        )}
        <span className={`break-all ${
          isSuccess ? 'text-success font-semibold' : 
          isWarning ? 'text-warning' : 
          isSectionTitle ? 'text-foreground font-semibold text-sm' :
          'text-equation'
        }`}>
          {step}
        </span>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Step-by-Step Solution
          <span className="text-xs text-muted-foreground font-normal ml-1">({steps.filter(s => s.trim()).length} steps)</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => exportSolutionAsPDF(title || 'Circuit Solution', steps, results, verification)}
          >
            <FileDown className="w-3 h-3" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1 pl-1 border-l-2 border-primary/20 ml-2">
          <div className="pl-3 space-y-0.5">
            {steps.map((step, i) => renderStep(step, i))}
          </div>
        </div>
      )}
      {copyError && <p role="alert" className="text-xs text-destructive">{copyError}</p>}
    </div>
  );
};

export default StepDisplay;
