import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, Clock, Play, RotateCcw, CheckCircle, XCircle, 
  ChevronRight, Eye, EyeOff, Target, Lightbulb, BarChart3
} from "lucide-react";

interface ExamQuestion {
  id: string;
  question: string;
  hints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  solution?: string;
}

type ExamConfig = {
  numQuestions: number;
  timeMinutes: number;
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard';
  topics: string[];
};

const ALL_QUESTIONS: ExamQuestion[] = [
  // DC
  { id: 'e1', question: 'A 24V source drives current through a 6kΩ resistor. Find I (mA) and P (mW).', hints: ['I = V/R', 'P = V²/R'], difficulty: 'easy', topic: 'DC', solution: 'I = 24/6000 = 4mA, P = 24²/6000 = 96mW' },
  { id: 'e2', question: 'Two resistors (3kΩ and 6kΩ) are in parallel across 12V. Find R_eq, total I, and I through each.', hints: ['1/R_eq = 1/R1 + 1/R2', 'Current divider'], difficulty: 'easy', topic: 'DC', solution: 'R_eq = 2kΩ, I_total = 6mA, I_3k = 4mA, I_6k = 2mA' },
  { id: 'e3', question: 'Voltage divider: Vs=20V, R1=5kΩ, R2=15kΩ. Find Vout across R2.', hints: ['V_out = Vs × R2/(R1+R2)'], difficulty: 'easy', topic: 'DC', solution: 'Vout = 20 × 15/(5+15) = 15V' },
  { id: 'e4', question: 'Find Thévenin equivalent: Vs=30V, R1=10kΩ, R2=20kΩ. Terminals across R2.', hints: ['V_th = V_oc', 'R_th = R1 ∥ R2 (sources off)'], difficulty: 'medium', topic: 'DC', solution: 'V_th = 30 × 20/(10+20) = 20V, R_th = 10k∥20k = 6.67kΩ' },
  { id: 'e5', question: 'Nodal analysis: 12V source at node 1, R1=1kΩ (n1-n2), R2=2kΩ (n2-gnd), R3=3kΩ (n2-gnd). Find V2.', hints: ['KCL at node 2', 'V1=12V (constrained)'], difficulty: 'medium', topic: 'DC', solution: 'KCL: (12-V2)/1k = V2/2k + V2/3k → V2 = 7.2V' },
  
  // Transient
  { id: 'e6', question: 'RC circuit: R=5kΩ, C=10μF, charged to 20V, discharging. Find τ and v(t=τ).', hints: ['τ = RC', 'At t=τ: 36.8% of initial'], difficulty: 'easy', topic: 'Transient', solution: 'τ = 50ms, v(τ) = 20 × 0.368 = 7.36V' },
  { id: 'e7', question: 'RL circuit: L=200mH, R=100Ω, Vs=10V, i(0)=0. Find τ and i(t=2τ).', hints: ['τ = L/R', 'Step: i(t) = (Vs/R)(1-e^(-t/τ))'], difficulty: 'medium', topic: 'Transient', solution: 'τ = 2ms, i(∞)=100mA, i(2τ) = 100(1-e^-2) = 86.5mA' },
  { id: 'e8', question: 'Switch opens at t=0. For t<0: Vs=15V, R1=3kΩ, R2=6kΩ, C=22μF. For t>0: C through R2. Find v_C(0) and τ.', hints: ['t<0: voltage divider for v_C(0)', 't>0: τ = R2×C'], difficulty: 'medium', topic: 'Transient', solution: 'v_C(0) = 15×6/(3+6) = 10V, τ = 6k×22μ = 132ms' },

  // RLC
  { id: 'e9', question: 'Series RLC: R=100Ω, L=10mH, C=1μF. Find α, ω₀, and classify damping.', hints: ['α = R/(2L)', 'ω₀ = 1/√(LC)', 'Compare α vs ω₀'], difficulty: 'easy', topic: 'RLC', solution: 'α = 5000, ω₀ = 10000, α < ω₀ → Underdamped' },
  { id: 'e10', question: 'Find R for critical damping: series RLC with L=25mH, C=10μF.', hints: ['Critical: α = ω₀', 'R = 2√(L/C)'], difficulty: 'medium', topic: 'RLC', solution: 'R = 2√(0.025/10⁻⁵) = 2√2500 = 100Ω' },
  { id: 'e11', question: 'Parallel RLC: R=2kΩ, L=50mH, C=0.2μF. Find α, ω₀, damping type.', hints: ['Parallel: α = 1/(2RC)', 'ω₀ = 1/√(LC)'], difficulty: 'medium', topic: 'RLC', solution: 'α = 1250, ω₀ = 10000, α < ω₀ → Underdamped' },

  // AC
  { id: 'e12', question: 'Series RLC at 60Hz: R=100Ω, L=0.5H, C=10μF. Find |Z| and phase angle.', hints: ['Z_L = jωL, Z_C = -j/(ωC)', '|Z| = √(R²+(X_L-X_C)²)'], difficulty: 'medium', topic: 'AC', solution: 'X_L=188.5Ω, X_C=265.3Ω, |Z|=127.6Ω, θ=-36.9°' },
  { id: 'e13', question: 'Load Z=30+j40Ω, V=120∠0°V. Find I, P, Q, S, and power factor.', hints: ['I=V/Z', 'S=VI*', 'pf=cos(θ_z)'], difficulty: 'medium', topic: 'AC', solution: 'I=2.4∠-53.1°A, P=172.8W, Q=230.4VAR, S=288VA, pf=0.6 lag' },
  { id: 'e14', question: 'Power factor correction: Motor draws 5kW at 0.7 lag from 240Vrms/60Hz. Find C for pf=0.95.', hints: ['Q_old=P×tan(θ_old)', 'Q_C=Q_old-Q_new', 'C=Q_C/(ωV²)'], difficulty: 'hard', topic: 'AC', solution: 'Q_old=5.1kVAR, Q_new=1.64kVAR, Q_C=3.46kVAR, C=160μF' },

  // Laplace
  { id: 'e15', question: 'Find L{5e^(-3t) + 2cos(4t) - 3u(t)}.', hints: ['L{e^(-at)}=1/(s+a)', 'L{cos(ωt)}=s/(s²+ω²)', 'L{u(t)}=1/s'], difficulty: 'easy', topic: 'Laplace', solution: 'F(s) = 5/(s+3) + 2s/(s²+16) - 3/s' },
  { id: 'e16', question: 'RC in s-domain: R=1kΩ, C=1μF, v_C(0)=5V, Vs=10/s. Find V_C(s).', hints: ['Impedance: R + 1/(sC)', 'Include initial condition'], difficulty: 'medium', topic: 'Laplace', solution: 'V_C(s) = 10/(s(s+1000)) + 5/(s+1000)' },

  // Bode
  { id: 'e17', question: 'RC low-pass: R=1kΩ, C=0.1μF. Find f_c and |H| at 10×f_c.', hints: ['f_c=1/(2πRC)', 'At 10f_c: |H|≈-20dB'], difficulty: 'easy', topic: 'Frequency', solution: 'f_c=1592Hz, at 10f_c: |H|=-20dB' },
  { id: 'e18', question: 'RLC resonance: L=10mH, C=1μF, R=50Ω. Find f₀, Q, and bandwidth.', hints: ['f₀=1/(2π√LC)', 'Q=(1/R)√(L/C)', 'BW=f₀/Q'], difficulty: 'medium', topic: 'Frequency', solution: 'f₀=1592Hz, Q=2, BW=796Hz' },
];

const TOPIC_OPTIONS = ['DC', 'Transient', 'RLC', 'AC', 'Laplace', 'Frequency'];

const PracticeExamTab = () => {
  const [mode, setMode] = useState<'config' | 'exam' | 'results'>('config');
  const [config, setConfig] = useState<ExamConfig>({
    numQuestions: 10,
    timeMinutes: 30,
    difficulty: 'mixed',
    topics: [...TOPIC_OPTIONS],
  });
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number; byTopic: Record<string, { correct: number; total: number }> } | null>(null);

  // Timer
  useEffect(() => {
    if (!examStarted || mode !== 'exam' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examStarted, mode, timeLeft]);

  const startExam = () => {
    // Filter and shuffle questions
    let pool = ALL_QUESTIONS.filter(q => config.topics.includes(q.topic));
    if (config.difficulty !== 'mixed') {
      pool = pool.filter(q => q.difficulty === config.difficulty);
    }
    // Shuffle
    pool = pool.sort(() => Math.random() - 0.5).slice(0, config.numQuestions);
    
    if (pool.length === 0) {
      return;
    }

    setQuestions(pool);
    setCurrentQ(0);
    setAnswers({});
    setShowHint({});
    setShowSolution({});
    setTimeLeft(config.timeMinutes * 60);
    setExamStarted(true);
    setScore(null);
    setMode('exam');
  };

  const finishExam = useCallback(() => {
    // Self-grading: count questions where user viewed solution
    const byTopic: Record<string, { correct: number; total: number }> = {};
    let correct = 0;

    questions.forEach(q => {
      if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
      byTopic[q.topic].total++;

      // If user wrote an answer and didn't peek at solution → count as attempted
      const answered = !!answers[q.id]?.trim();
      const peeked = !!showSolution[q.id];
      if (answered && !peeked) {
        correct++;
        byTopic[q.topic].correct++;
      }
    });

    setScore({ correct, total: questions.length, byTopic });
    setMode('results');
    setExamStarted(false);
  }, [questions, answers, showSolution]);

  const toggleTopic = (topic: string) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic]
    }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'bg-success/10 text-success border-success/30';
      case 'medium': return 'bg-accent/10 text-accent border-accent/30';
      case 'hard': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return '';
    }
  };

  if (mode === 'config') {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-lg bg-card border border-border">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-accent" />
            Practice Exam Mode
          </h3>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Number of Questions</label>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setConfig(prev => ({ ...prev, numQuestions: n }))}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      config.numQuestions === n
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Time Limit</label>
              <div className="flex gap-2">
                {[15, 30, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setConfig(prev => ({ ...prev, timeMinutes: m }))}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      config.timeMinutes === m
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Difficulty</label>
              <div className="flex gap-2">
                {['mixed', 'easy', 'medium', 'hard'].map(d => (
                  <button
                    key={d}
                    onClick={() => setConfig(prev => ({ ...prev, difficulty: d as any }))}
                    className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors capitalize ${
                      config.difficulty === d
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Topics</label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_OPTIONS.map(topic => (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      config.topics.includes(topic)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={startExam} className="mt-6 gap-2" size="lg" disabled={config.topics.length === 0}>
            <Play className="w-4 h-4" /> Start Exam
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'results' && score) {
    const pct = Math.round((score.correct / score.total) * 100);
    const grade = 'Not graded';
    
    return (
      <div className="space-y-6">
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Trophy className={`w-12 h-12 mx-auto mb-3 ${pct >= 70 ? 'text-accent' : 'text-muted-foreground'}`} />
              <h3 className="text-2xl font-bold text-foreground">Exam Complete</h3>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold text-primary">{pct}%</p>
                  <p className="text-xs text-muted-foreground">Unassisted completion</p>
                </div>
                <div className="text-center">
                  <p className={`text-4xl font-mono font-bold ${pct >= 70 ? 'text-success' : 'text-destructive'}`}>{grade}</p>
                  <p className="text-xs text-muted-foreground">Answer checking unavailable</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold text-foreground">{score.correct}/{score.total}</p>
                  <p className="text-xs text-muted-foreground">Attempted without notes</p>
                </div>
              </div>
            </div>

            {/* By topic */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Completion by Topic</h4>
              {Object.entries(score.byTopic).map(([topic, data]) => (
                <div key={topic} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20">{topic}</span>
                  <Progress value={(data.correct / data.total) * 100} className="flex-1 h-2" />
                  <span className="text-xs font-mono text-foreground w-12 text-right">{data.correct}/{data.total}</span>
                </div>
              ))}
            </div>

            {/* Review questions */}
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Question Review</h4>
              {questions.map((q, i) => (
                <div key={q.id} className="p-3 rounded-md bg-muted/50 border border-border text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-mono shrink-0">Q{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-foreground">{q.question}</p>
                      <p className="mt-1 text-warning text-[11px]">Answer key coming soon — not independently checked.</p>
                      {answers[q.id] && (
                        <p className="mt-1 text-muted-foreground">Your work: {answers[q.id]}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`${difficultyColor(q.difficulty)} text-[9px] shrink-0`}>{q.difficulty}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => setMode('config')} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> New Exam
              </Button>
              <Button onClick={startExam} className="gap-2">
                <Play className="w-4 h-4" /> Retry Same Config
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Exam mode
  const q = questions[currentQ];
  if (!q) return null;

  const timeWarning = timeLeft < 120;
  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            Q {currentQ + 1} / {questions.length}
          </Badge>
          <Progress value={progress} className="w-32 h-2" />
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-sm ${timeWarning ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
          <Clock className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
        <Button variant="destructive" size="sm" className="text-xs" onClick={finishExam}>
          End Exam
        </Button>
      </div>

      {/* Question */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className={`${difficultyColor(q.difficulty)} text-[10px]`}>{q.difficulty}</Badge>
            <Badge variant="secondary" className="text-[10px]">{q.topic}</Badge>
          </div>

          <p className="text-base text-foreground leading-relaxed mb-6">{q.question}</p>

          {/* Answer area */}
          <textarea
            value={answers[q.id] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            placeholder="Show your work here... Write equations, intermediate steps, and final answer."
            className="w-full h-32 rounded-md bg-muted/50 border border-border p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Hints */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setShowHint(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {showHint[q.id] ? 'Hide Hints' : 'Show Hints'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-warning"
              onClick={() => setShowSolution(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
            >
              {showSolution[q.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSolution[q.id] ? 'Hide status' : 'Answer-key status'}
            </Button>
          </div>

          {showHint[q.id] && (
            <div className="mt-3 p-3 rounded-md bg-accent/10 border border-accent/30">
              <p className="text-xs font-semibold text-accent mb-1">Hints:</p>
              {q.hints.map((h, i) => (
                <p key={i} className="text-xs text-accent/80 font-mono">• {h}</p>
              ))}
            </div>
          )}

          {showSolution[q.id] && q.solution && (
            <div className="mt-3 p-3 rounded-md bg-success/10 border border-success/30">
              <p className="text-xs text-warning">Answer withheld — this practice answer key has not passed independent checks.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
          disabled={currentQ === 0}
        >
          ← Previous
        </Button>

        {/* Question dots */}
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-6 h-6 rounded-full text-[9px] font-mono border transition-colors ${
                i === currentQ
                  ? 'bg-primary text-primary-foreground border-primary'
                  : answers[questions[i].id]
                  ? 'bg-success/20 border-success/40 text-success'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentQ < questions.length - 1 ? (
          <Button size="sm" onClick={() => setCurrentQ(prev => prev + 1)} className="gap-1">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button size="sm" onClick={finishExam} className="gap-1 bg-success hover:bg-success/90">
            <CheckCircle className="w-3.5 h-3.5" /> Finish
          </Button>
        )}
      </div>
    </div>
  );
};

export default PracticeExamTab;
