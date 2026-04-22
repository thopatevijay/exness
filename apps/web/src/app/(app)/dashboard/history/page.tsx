import { ClosedPositionsTable } from '@/components/ClosedPositionsTable';

export default function HistoryPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">History</h1>
      <div className="mt-4 overflow-x-auto rounded-md border border-[color:var(--color-border)]">
        <ClosedPositionsTable />
      </div>
    </main>
  );
}
