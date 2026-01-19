export default function ApplicationOverviewLoading() {
  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-64 bg-muted rounded" />
          <div className="h-10 w-96 bg-muted rounded" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-96 bg-muted rounded" />
              <div className="h-64 bg-muted rounded" />
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-muted rounded" />
              <div className="h-64 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
