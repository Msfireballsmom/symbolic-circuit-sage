import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { ET310_CASES, ET310_TOPICS, runET310Coverage } from '@/lib/et310-coverage';

export default function ET310Coverage() {
  const [report, setReport] = useState<ReturnType<typeof runET310Coverage> | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    window.setTimeout(() => { setReport(runET310Coverage()); setRunning(false); }, 0);
  };
  const rows = report ?? ET310_TOPICS.map(topic => ({ ...topic, status: 'coming soon', passed: 0, total: ET310_CASES.filter(test => test.topic === topic.id).length, failures: [] }));
  return <section className="space-y-4" aria-label="ET310 developer coverage">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground">ET310 developer coverage</h2>
      <Button onClick={run} disabled={running} variant="outline" className="gap-2"><Play className="w-4 h-4" />{running ? 'Running original cases…' : 'Run ET310 verification'}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Certified means the listed original fixtures passed now, not that every assignment or topology is covered. No private documents or answer keys are included.</p>
    {report && <p role="status" className="text-sm font-mono text-foreground">{report.reduce((s, t) => s + t.passed, 0)} / {ET310_CASES.length} cases passed · {report.reduce((s, t) => s + t.failures.length, 0)} failing</p>}
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="p-2">Week</th><th className="p-2">Topic / tested scope</th><th className="p-2">Status</th><th className="p-2">Cases</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-border align-top">
          <td className="p-2 whitespace-nowrap">{row.week}</td>
          <td className="p-2"><p className="font-semibold text-foreground">{row.topic}</p><p className="text-muted-foreground mt-1">{row.scope}</p>
            {row.failures.map(failure => <p key={failure.id} className="text-destructive mt-1">{failure.id}: {failure.error}</p>)}
          </td>
          <td className={`p-2 whitespace-nowrap ${row.status === 'certified' ? 'text-success' : row.status === 'failing' ? 'text-destructive' : 'text-warning'}`}>
            {report || row.total === 0 ? row.status : 'coming soon — not run'}
          </td><td className="p-2 whitespace-nowrap">{row.passed}/{row.total}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}