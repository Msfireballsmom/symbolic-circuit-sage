import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { gradeBlanks, verifiedExamItems, type GradedBlank } from '@/lib/exam-bank';
import { Trophy } from 'lucide-react';

export default function PracticeExamTab() {
  const bank = useMemo(() => verifiedExamItems(), []);
  const [count, setCount] = useState(5);
  const [started, setStarted] = useState(false);
  const [responses, setResponses] = useState<Record<string, Record<string, string>>>({});
  const [graded, setGraded] = useState<Record<string, GradedBlank[]> | null>(null);

  const questions = bank.slice(0, Math.min(count, bank.length));

  const grade = () => {
    const next: Record<string, GradedBlank[]> = {};
    for (const entry of questions) {
      const student: Record<string, number> = {};
      for (const blank of entry.item.blanks) {
        const text = responses[entry.item.id]?.[blank.key] ?? '';
        student[blank.key] = text.trim() ? Number(text) : NaN;
      }
      next[entry.item.id] = gradeBlanks(entry.item, entry.key, student);
    }
    setGraded(next);
  };

  const correctCount = graded
    ? questions.filter(entry => graded[entry.item.id]?.every(blank => blank.match)).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-card border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Practice exam
        </h3>
        <p className="text-xs text-muted-foreground">
          Every key is computed by a solver and checked against a second formula before the question is offered. A blank matches within 2%, or within 0.000001 when the value is near zero. Written work is not graded. {bank.length} checked questions are available.
        </p>
        {!started && (
          <div className="flex flex-wrap items-center gap-2">
            {[5, bank.length].filter((value, index, list) => list.indexOf(value) === index && value > 0).map(value => (
              <button key={value} type="button" onClick={() => setCount(value)} className={`px-3 py-1.5 rounded-md text-xs border ${count === value ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}>
                {value} questions
              </button>
            ))}
            <Button type="button" onClick={() => { setStarted(true); setGraded(null); }} disabled={bank.length === 0}>Start</Button>
          </div>
        )}
      </div>
      {started && questions.map((entry, index) => (
        <section key={entry.item.id} className="p-4 rounded-lg bg-card border border-border space-y-3">
          <p className="text-xs text-muted-foreground">{entry.item.topic} · {entry.item.difficulty}</p>
          <h4 className="text-sm font-medium">{index + 1}. {entry.item.prompt}</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {entry.item.blanks.map(blank => (
              <label key={blank.key} className="text-xs text-muted-foreground">
                {blank.label} ({blank.unit})
                <Input
                  className="mt-1 h-8 font-mono text-xs"
                  inputMode="decimal"
                  value={responses[entry.item.id]?.[blank.key] ?? ''}
                  onChange={event => setResponses(current => ({
                    ...current,
                    [entry.item.id]: { ...current[entry.item.id], [blank.key]: event.target.value },
                  }))}
                />
              </label>
            ))}
          </div>
          {graded?.[entry.item.id] && (
            <ul className="text-xs font-mono space-y-1">
              {graded[entry.item.id].map(blank => (
                <li key={blank.key} className={blank.match ? 'text-success' : 'text-destructive'}>
                  {blank.label}: yours {Number.isFinite(blank.student) ? blank.student : 'blank'} · key {blank.correct.toPrecision(6)} {blank.unit} · {blank.match ? 'match' : 'does not match'}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {started && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={grade}>Grade answers</Button>
          {graded && <p className="text-sm">{correctCount} of {questions.length} questions matched every blank.</p>}
        </div>
      )}
    </div>
  );
}
