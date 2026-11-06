/** Esqueleto exibido enquanto os dados são carregados do servidor. */
export default function Loading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Carregando">
      <div className="h-7 w-44 animate-pulse rounded-md bg-azure-100/70" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-lg border border-line bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-line bg-white" />
    </div>
  );
}
