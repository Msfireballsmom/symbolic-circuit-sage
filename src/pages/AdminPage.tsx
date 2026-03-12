import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { runAllTests, TestResult, TestReport } from "@/lib/self-test";
import {
  Shield, Play, CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown,
  ChevronUp, Download, ArrowLeft, Loader2, FlaskConical, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = "admin123";

const AdminPage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passError, setPassError] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<TestResult[]>([]);
  const [report, setReport] = useState<TestReport | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    setLiveResults([]);
    setReport(null);
    setExpandedTest(null);

    const finalReport = await runAllTests((result) => {
      setLiveResults(prev => {
        const existing = prev.findIndex(r => r.id === result.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result;
          return updated;
        }
        return [...prev, result];
      });
    });

    setReport(finalReport);
    setIsRunning(false);
  };

  const exportPDF = () => {
    if (!report) return;
    // Generate a text report and trigger download
    const lines = [
      `CIRCUIT SOLVER PRO — SELF-TEST REPORT`,
      `Generated: ${report.timestamp}`,
      `Score: ${report.overallScore} (${((report.passed / report.totalTests) * 100).toFixed(0)}%)`,
      `Duration: ${(report.durationMs / 1000).toFixed(2)}s`,
      ``,
      `RESULTS:`,
      `${'='.repeat(80)}`,
    ];

    report.results.forEach(r => {
      const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
      lines.push(`${icon} [${r.status.toUpperCase()}] ${r.name}`);
      lines.push(`  Category: ${r.category}`);
      lines.push(`  Problem: ${r.problem}`);
      lines.push(`  Expected: ${r.expectedAnswer}`);
      lines.push(`  Actual: ${r.actualAnswer}`);
      if (r.error) lines.push(`  Error: ${r.error}`);
      lines.push(`  Time: ${r.durationMs.toFixed(1)}ms`);
      lines.push(``);
    });

    lines.push(`${'='.repeat(80)}`);
    lines.push(`SUMMARY: ${report.passed} passed, ${report.failed} failed, ${report.errors} errors`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit-solver-test-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Access</h1>
            <p className="text-sm text-muted-foreground">Enter password to access self-test panel</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPassError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Password"
              className={`h-10 font-mono ${passError ? 'border-destructive' : ''}`}
            />
            {passError && <p className="text-xs text-destructive">Wrong password</p>}
            <Button onClick={handleLogin} className="w-full gap-2">
              <Shield className="w-4 h-4" /> Enter Admin
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => navigate('/')}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = liveResults.length > 0
    ? (liveResults.filter(r => r.status !== 'running' && r.status !== 'pending').length / Math.max(liveResults.length, 1)) * 100
    : 0;

  const statusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'fail': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return 'bg-success/10 border-success/30 text-success';
      case 'fail': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'error': return 'bg-warning/10 border-warning/30 text-warning';
      default: return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Banner */}
      <div className="sticky top-0 z-[60] px-4 py-2 bg-destructive/20 border-b border-destructive/30 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
          <Shield className="w-3.5 h-3.5" />
          ADMIN MODE — Self-Test Panel
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive/10" onClick={() => navigate('/')}>
          <ArrowLeft className="w-3 h-3" /> Back to App
        </Button>
      </div>

      <div className="container px-4 py-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-primary" />
              Circuit Solver Pro — Self-Test
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated testing of every solver with known problems and verified answers
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground font-mono">
            <p>v3.0</p>
            <p>25 tests</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleRunTests} disabled={isRunning} className="gap-2" size="lg">
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Running Tests...' : 'Run Full Self-Test'}
          </Button>
          {report && (
            <Button onClick={exportPDF} variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export Report
            </Button>
          )}
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Testing...</span>
              <span>{liveResults.filter(r => r.status !== 'running').length} / {liveResults.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Score Card */}
        {report && (
          <div className="p-6 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Test Report</h2>
              <span className="text-xs text-muted-foreground font-mono">{(report.durationMs / 1000).toFixed(2)}s total</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-3xl font-mono font-bold text-primary">{report.overallScore}</p>
                <p className="text-xs text-muted-foreground mt-1">Score</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="text-3xl font-mono font-bold text-success">{report.passed}</p>
                <p className="text-xs text-muted-foreground mt-1">Passed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-3xl font-mono font-bold text-destructive">{report.failed}</p>
                <p className="text-xs text-muted-foreground mt-1">Failed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-3xl font-mono font-bold text-warning">{report.errors}</p>
                <p className="text-xs text-muted-foreground mt-1">Errors</p>
              </div>
            </div>

            {/* Overall percentage bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Overall</span>
                <span>{((report.passed / report.totalTests) * 100).toFixed(0)}%</span>
              </div>
              <Progress
                value={(report.passed / report.totalTests) * 100}
                className="h-3"
              />
            </div>
          </div>
        )}

        {/* Test Results List */}
        {liveResults.length > 0 && (
          <div className="space-y-2" ref={scrollRef}>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Individual Test Results
            </h3>

            {/* Group by category */}
            {Array.from(new Set(liveResults.map(r => r.category))).map(category => (
              <div key={category} className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-1">{category}</h4>
                {liveResults.filter(r => r.category === category).map(result => (
                  <div key={result.id} className={`rounded-lg border transition-all ${statusColor(result.status)}`}>
                    <button
                      className="w-full flex items-center gap-3 p-3 text-left"
                      onClick={() => setExpandedTest(expandedTest === result.id ? null : result.id)}
                    >
                      {statusIcon(result.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.name}</p>
                        <p className="text-xs opacity-70 truncate">{result.problem}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {result.status === 'running' ? '...' : `${result.durationMs.toFixed(0)}ms`}
                      </Badge>
                      {result.status !== 'running' && (
                        expandedTest === result.id
                          ? <ChevronUp className="w-4 h-4 shrink-0 opacity-50" />
                          : <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                      )}
                    </button>

                    {expandedTest === result.id && result.status !== 'running' && (
                      <div className="px-3 pb-3 space-y-2 border-t border-current/10 pt-2">
                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Expected:</span>
                            <span className="text-foreground">{result.expectedAnswer}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Actual:</span>
                            <span className="text-foreground">{result.actualAnswer}</span>
                          </div>
                        </div>
                        {result.error && (
                          <div className="text-xs font-mono text-destructive bg-destructive/5 p-2 rounded">
                            Error: {result.error}
                          </div>
                        )}
                        {result.steps && result.steps.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Show solution steps ({result.steps.length} lines)
                            </summary>
                            <div className="mt-1 p-2 rounded bg-background/50 max-h-60 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                              {result.steps.join('\n')}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Features List */}
        {!report && !isRunning && (
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3">What Gets Tested</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              {[
                { cat: "Quick Solve", tests: "Ohm's Law, Series/Parallel, Voltage Divider, Current Divider, Thévenin, Power" },
                { cat: "DC Analysis", tests: "Nodal analysis with 2+ nodes, voltage sources, current sources" },
                { cat: "Mesh Analysis", tests: "2-mesh KVL with shared resistors, power balance verification" },
                { cat: "Transient", tests: "RC and RL circuits — time constant, initial/final values" },
                { cat: "RLC 2nd Order", tests: "Underdamped and overdamped classification, damping parameters" },
                { cat: "AC Phasor", tests: "Series RLC impedance, power factor, voltage/current phasors" },
                { cat: "Laplace", tests: "Real poles, complex poles, stability, DC gain, natural frequency" },
                { cat: "Fourier", tests: "Square and triangle wave coefficients, symmetry detection" },
                { cat: "Op-Amp", tests: "Inverting and non-inverting gain and output voltage" },
                { cat: "Diode", tests: "Forward bias, Zener regulator, half-wave rectifier" },
                { cat: "Bode Plot", tests: "RC low-pass cutoff frequency and -3dB point" },
              ].map(item => (
                <div key={item.cat} className="p-2 rounded-md bg-muted/30 border border-border">
                  <span className="font-semibold text-foreground">{item.cat}</span>
                  <p className="mt-0.5">{item.tests}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
