import { WORKFLOW_AVAILABILITY, type WorkflowId } from '@/lib/workflow-availability';

export default function UnavailableWorkflow({ id }: { id: WorkflowId }) {
  return <section className="space-y-2 py-4" role="status">
    <h2 className="text-lg font-semibold text-warning">Coming Soon / Unverified — disabled</h2>
    <p className="text-sm text-muted-foreground">{WORKFLOW_AVAILABILITY[id].reason}</p>
  </section>;
}