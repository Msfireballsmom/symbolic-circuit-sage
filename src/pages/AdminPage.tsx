import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { runAllTests, TestResult, TestReport } from "@/lib/self-test";
import { runAITests, AITestResult, AITestReport } from "@/lib/ai-test-runner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, Play, CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown,
  ChevronUp, Download, ArrowLeft, Loader2, FlaskConical, Zap, Brain, Globe, Sparkles, History
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminPage = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<TestResult[]>([]);
  const [report, setReport] = useState<TestReport | null>(null);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [aiResults, setAiResults] = useState<AITestResult[]>([]);
  const [aiReport, setAiReport] = useState<AITestReport | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hardcoded' | 'ai' | 'history'>('hardcoded');
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin && activeTab === 'history') {
      loadAuditLog();
    }
  }, [isAdmin, activeTab]);

  const loadAuditLog = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("benchmark_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setAuditLog(data || []);
    setLoadingHistory(false);
  };

  const saveAuditLog = async (totalTests: number, passed: number, failed: number, errors: number, durationMs: number, results: any[]) => {
    if (!user) return;
    await supabase.from("benchmark_runs").insert({
      user_id: user.id,
      run_type: 'full',
      total_tests: totalTests,
      passed,
      failed,
      errors,
      accuracy: totalTests > 0 ? (passed / totalTests) * 100 : 0,
      duration_ms: Math.round(durationMs),
      results: results as any,
      solver_version: 'v4.0',
    });
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

  const handleRunAITests = async () => {
    setIsRunningAI(true);
    setAiResults([]);
    setAiReport(null);
    setExpandedTest(null);

    const finalReport = await runAITests((result) => {
      setAiResults(prev => {
        const existing = prev.findIndex(r => r.id === result.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result;
          return updated;
        }
        return [...prev, result];
      });
    });

    setAiReport(finalReport);
    setIsRunningAI(false);
  };

  const handleRunAll = async () => {
    setActiveTab('hardcoded');
    await handleRunTests();
    setActiveTab('ai');
    await handleRunAITests();
    // Save combined audit log
    const totalPassed = (report?.passed || 0) + (aiReport?.passed || 0);
    const totalTests = (report?.totalTests || 0) + (aiReport?.totalTests || 0);
    const totalFailed = (report?.failed || 0) + (aiReport?.failed || 0);
    const totalErrors = (report?.errors || 0) + (aiReport?.errors || 0);
    const totalDuration = (report?.durationMs || 0) + (aiReport?.durationMs || 0);
    await saveAuditLog(totalTests, totalPassed, totalFailed, totalErrors, totalDuration, [
      ...(report?.results || []).map(r => ({ name: r.name, status: r.status, type: 'hardcoded' })),
      ...(aiReport?.results || []).map(r => ({ title: r.title, status: r.status, type: 'ai' })),
    ]);
  };

  const exportReport = () => {
    const lines = [
      `CIRCUIT SOLVER PRO — FULL TEST REPORT`,
      `Generated: ${new Date().toISOString()}`,
      ``,
    ];

    if (report) {
      lines.push(`═══ HARDCODED SOLVER TESTS ═══`);
      lines.push(`Score: ${report.overallScore} (${((report.passed / report.totalTests) * 100).toFixed(0)}%)`);
      lines.push(`Duration: ${(report.durationMs / 1000).toFixed(2)}s`);
      lines.push(``);
      report.results.forEach(r => {
        const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
        lines.push(`${icon} [${r.status.toUpperCase()}] ${r.name}`);
        lines.push(`  Problem: ${r.problem}`);
        lines.push(`  Expected: ${r.expectedAnswer}`);
        lines.push(`  Actual: ${r.actualAnswer}`);
        if (r.error) lines.push(`  Error: ${r.error}`);
        lines.push(``);
      });
    }

    if (aiReport) {
      lines.push(`═══ AI-GENERATED NOVEL PROBLEM TESTS ═══`);
      lines.push(`Score: ${aiReport.overallScore} (${((aiReport.passed / aiReport.totalTests) * 100).toFixed(0)}%)`);
      lines.push(`Duration: ${(aiReport.durationMs / 1000).toFixed(2)}s`);
      lines.push(``);
      aiReport.results.forEach(r => {
        const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠';
        lines.push(`${icon} [${r.status.toUpperCase()}] ${r.title}`);
        lines.push(`  Source: ${r.sourceStyle}`);
        lines.push(`  Difficulty: ${r.difficulty}`);
        lines.push(`  Problem: ${r.problemDescription}`);
        lines.push(`  Verification: ${r.verificationMethod}`);
        lines.push(`  Solver Output: ${r.solverOutput}`);
        if (r.error) lines.push(`  Error: ${r.error}`);
        lines.push(``);
      });
    }

    lines.push(`═══ SUMMARY ═══`);
    const totalPassed = (report?.passed || 0) + (aiReport?.passed || 0);
    const totalTests = (report?.totalTests || 0) + (aiReport?.totalTests || 0);
    lines.push(`Total: ${totalPassed}/${totalTests} passed`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit-solver-test-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse text-sm font-mono">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Access Required</h1>
            <p className="text-sm text-muted-foreground">
              {!user ? "You must be signed in with an admin account." : "Your account does not have admin privileges."}
            </p>
          </div>
          <div className="space-y-3">
            <Button variant="ghost" className="w-full text-xs" onClick={() => navigate(user ? '/' : '/auth')}>
              <ArrowLeft className="w-3 h-3 mr-1" /> {user ? 'Back to App' : 'Sign In'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = liveResults.length > 0
    ? (liveResults.filter(r => r.status !== 'running' && r.status !== 'pending').length / Math.max(liveResults.length, 1)) * 100
    : 0;

  const aiProgress = aiResults.length > 0
    ? (aiResults.filter(r => r.status !== 'running' && r.status !== 'pending').length / Math.max(aiResults.length, 1)) * 100
    : 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'fail': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'fail': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'error': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default: return 'bg-muted border-border text-muted-foreground';
    }
  };

  const totalPassed = (report?.passed || 0) + (aiReport?.passed || 0);
  const totalTests = (report?.totalTests || 0) + (aiReport?.totalTests || 0);

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

      <div className="container px-4 py-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-primary" />
              Circuit Sage — Self-Test
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hardcoded verification + AI-generated novel problems
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground font-mono">
            <p>v4.0</p>
            <p>25 hardcoded + 10 AI-generated</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleRunAll} disabled={isRunning || isRunningAI} className="gap-2" size="lg">
            {(isRunning || isRunningAI) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run All Tests (35)
          </Button>
          <Button onClick={handleRunTests} disabled={isRunning || isRunningAI} variant="outline" className="gap-2">
            <Zap className="w-4 h-4" />
            Hardcoded Only (25)
          </Button>
          <Button onClick={handleRunAITests} disabled={isRunning || isRunningAI} variant="outline" className="gap-2">
            <Brain className="w-4 h-4" />
            AI Novel Problems (10)
          </Button>
          {(report || aiReport) && (
            <Button onClick={exportReport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export Report
            </Button>
          )}
        </div>

        {/* Combined Score Card */}
        {(report || aiReport) && !isRunning && !isRunningAI && (
          <div className="p-6 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Combined Test Report</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {((report?.durationMs || 0) + (aiReport?.durationMs || 0)) / 1000 | 0}s total
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-2xl font-mono font-bold text-primary">{totalPassed}/{totalTests}</p>
                <p className="text-xs text-muted-foreground mt-1">Overall</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-xl font-mono font-bold text-emerald-400">{report?.passed || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Hardcoded ✓</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-xl font-mono font-bold text-emerald-400">{aiReport?.passed || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">AI Novel ✓</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-xl font-mono font-bold text-destructive">{(report?.failed || 0) + (aiReport?.failed || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Failed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-xl font-mono font-bold text-amber-400">{(report?.errors || 0) + (aiReport?.errors || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Errors</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Overall Accuracy</span>
                <span>{totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(0) : 0}%</span>
              </div>
              <Progress value={totalTests > 0 ? (totalPassed / totalTests) * 100 : 0} className="h-3" />
            </div>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex gap-2 border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'hardcoded' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('hardcoded')}
          >
            <Zap className="w-3.5 h-3.5 inline mr-1.5" />
            Hardcoded Tests (25)
            {report && <Badge variant="outline" className="ml-2 text-[10px]">{report.passed}/{report.totalTests}</Badge>}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ai' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('ai')}
          >
            <Brain className="w-3.5 h-3.5 inline mr-1.5" />
            AI Novel Problems (10)
            {aiReport && <Badge variant="outline" className="ml-2 text-[10px]">{aiReport.passed}/{aiReport.totalTests}</Badge>}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('history')}
          >
            <History className="w-3.5 h-3.5 inline mr-1.5" />
            Audit Log
          </button>
        </div>

        {/* Progress bars */}
        {isRunning && activeTab === 'hardcoded' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Running hardcoded tests...</span>
              <span>{liveResults.filter(r => r.status !== 'running').length} / {liveResults.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        {isRunningAI && activeTab === 'ai' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                Generating & solving novel problems...
              </span>
              <span>{aiResults.filter(r => r.status !== 'running').length} / {aiResults.length || 10}</span>
            </div>
            <Progress value={aiProgress} className="h-2" />
          </div>
        )}

        {/* HARDCODED TAB */}
        {activeTab === 'hardcoded' && (
          <>
            {liveResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Hardcoded Solver Verification
                </h3>
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
            {!report && !isRunning && liveResults.length === 0 && (
              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="text-sm font-bold text-foreground mb-3">Hardcoded Tests — What Gets Verified</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  {[
                    { cat: "Quick Solve", tests: "Ohm's Law, Series/Parallel, Voltage Divider, Current Divider, Thévenin, Power" },
                    { cat: "DC Analysis", tests: "Nodal analysis with voltage sources, verified by KCL" },
                    { cat: "Mesh Analysis", tests: "2-mesh KVL, power balance verification" },
                    { cat: "Transient", tests: "RC and RL time constants, initial/final values" },
                    { cat: "RLC", tests: "Underdamped and overdamped classification" },
                    { cat: "AC Phasor", tests: "Impedance, power factor" },
                    { cat: "Laplace", tests: "Poles, stability, DC gain" },
                    { cat: "Fourier", tests: "Harmonic coefficients" },
                    { cat: "Op-Amp", tests: "Inverting and non-inverting gain" },
                    { cat: "Diode", tests: "Forward bias, Zener, rectifier" },
                    { cat: "Bode", tests: "Cutoff frequency, -3dB" },
                  ].map(item => (
                    <div key={item.cat} className="p-2 rounded-md bg-muted/30 border border-border">
                      <span className="font-semibold text-foreground">{item.cat}</span>
                      <p className="mt-0.5">{item.tests}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* AI TAB */}
        {activeTab === 'ai' && (
          <>
            {aiResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  AI-Generated Novel Problems — Never Seen Before
                </h3>
                {aiResults.map(result => (
                  <div key={result.id} className={`rounded-lg border transition-all ${statusColor(result.status)}`}>
                    <button
                      className="w-full flex items-center gap-3 p-3 text-left"
                      onClick={() => setExpandedTest(expandedTest === result.id ? null : result.id)}
                    >
                      {statusIcon(result.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Globe className="w-3 h-3" /> {result.sourceStyle}
                          </span>
                          {result.difficulty && (
                            <Badge variant="outline" className="text-[10px]">{result.difficulty}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{result.category}</Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {result.status === 'running' ? '...' : `${(result.durationMs / 1000).toFixed(1)}s`}
                      </Badge>
                      {result.status !== 'running' && (
                        expandedTest === result.id
                          ? <ChevronUp className="w-4 h-4 shrink-0 opacity-50" />
                          : <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                      )}
                    </button>
                    {expandedTest === result.id && result.status !== 'running' && (
                      <div className="px-3 pb-3 space-y-3 border-t border-current/10 pt-2">
                        {/* Problem Statement */}
                        <div className="text-xs">
                          <span className="text-muted-foreground block mb-1 font-semibold">Problem Statement:</span>
                          <div className="p-2 rounded bg-background/50 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                            {result.problemDescription}
                          </div>
                        </div>

                        {/* Verification */}
                        <div className="text-xs">
                          <span className="text-muted-foreground block mb-1 font-semibold">Verification Method:</span>
                          <span className="text-foreground font-mono text-[11px]">{result.verificationMethod}</span>
                        </div>

                        {/* Solver Output */}
                        {result.solverOutput && (
                          <div className="text-xs">
                            <span className="text-muted-foreground block mb-1 font-semibold">Solver Output:</span>
                            <div className="p-2 rounded bg-background/50 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                              {result.solverOutput}
                            </div>
                          </div>
                        )}

                        {/* Expected vs Actual */}
                        {result.expectedAnswers.length > 0 && (
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground block mb-1 font-semibold">AI Expected:</span>
                              <div className="space-y-0.5 font-mono text-[11px]">
                                {result.expectedAnswers.map((a, i) => (
                                  <div key={i}>{a.label} = {a.value} {a.unit}</div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1 font-semibold">Solver Computed:</span>
                              <div className="space-y-0.5 font-mono text-[11px]">
                                {result.actualAnswers.map((a, i) => (
                                  <div key={i}>{a.label} = {a.value.toFixed(6)}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {result.error && (
                          <div className="text-xs font-mono text-destructive bg-destructive/5 p-2 rounded">
                            Error: {result.error}
                          </div>
                        )}

                        {result.steps && result.steps.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold">
                              Show full solution steps ({result.steps.length} lines)
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
            )}
            {!aiReport && !isRunningAI && aiResults.length === 0 && (
              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  AI Novel Problem Tests
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Generates fresh, never-before-seen circuit problems using AI, then solves them with the deterministic math engine and verifies using KCL/KVL physics checks.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {[
                    "DC Nodal Analysis", "Mesh Analysis", "AC Phasor", "RC Transient",
                    "Op-Amp Circuits", "Laplace Transform", "Thévenin Equivalent",
                    "Fourier Series", "RLC Transient", "Power Analysis"
                  ].map(cat => (
                    <div key={cat} className="p-2 rounded bg-muted/30 border border-border flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Benchmark Audit Log
              </h3>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={loadAuditLog} disabled={loadingHistory}>
                {loadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                Refresh
              </Button>
            </div>
            {auditLog.length === 0 ? (
              <div className="p-6 rounded-xl bg-card border border-border text-center">
                <p className="text-sm text-muted-foreground">No benchmark runs recorded yet. Run a full test suite to create the first audit entry.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLog.map((run: any) => (
                  <div key={run.id} className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={run.accuracy >= 100 ? "default" : "secondary"} className="text-[10px]">
                          {Number(run.accuracy).toFixed(1)}%
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">{run.solver_version}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleDateString()} {new Date(run.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="font-mono font-bold text-foreground">{run.total_tests}</p>
                        <p className="text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="font-mono font-bold text-success">{run.passed}</p>
                        <p className="text-muted-foreground">Passed</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="font-mono font-bold text-destructive">{run.failed}</p>
                        <p className="text-muted-foreground">Failed</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="font-mono font-bold text-foreground">{(run.duration_ms / 1000).toFixed(1)}s</p>
                        <p className="text-muted-foreground">Duration</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
