import { CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";

interface StepDisplayProps {
  steps: string[];
}

const StepDisplay = ({ steps }: StepDisplayProps) => (
  <div className="space-y-1.5 mt-4">
    <h4 className="text-sm font-semibold text-foreground mb-2">Step-by-Step Derivation</h4>
    {steps.map((step, i) => {
      const isSuccess = step.startsWith('✓');
      const isWarning = step.startsWith('⚠');
      return (
        <div
          key={i}
          className="flex items-start gap-2 text-sm font-mono animate-slide-up"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {isSuccess ? (
            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
          )}
          <span className={`${isSuccess ? 'text-success' : isWarning ? 'text-warning' : 'text-equation'} break-all`}>
            {step}
          </span>
        </div>
      );
    })}
  </div>
);

export default StepDisplay;
