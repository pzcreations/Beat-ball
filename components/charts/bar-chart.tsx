import { formatInt } from "@/lib/format";

type Point = { dia: string; total: number };

function label(dia: string) {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/**
 * Gráfico de barras discreto (SVG puro, renderizado no servidor).
 * Inclui tabela equivalente para leitores de tela.
 */
export function BarChart({ data }: { data: Point[] }) {
  const W = 640;
  const H = 168;
  const padTop = 12;
  const padBottom = 24;
  const padLeft = 28;
  const innerH = H - padTop - padBottom;
  const innerW = W - padLeft;
  const max = Math.max(1, ...data.map((d) => d.total));
  // Escala "redonda" para as linhas de grade.
  const step = max <= 4 ? 1 : Math.ceil(max / 4 / 5) * 5 || 1;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(14, slot * 0.58));
  const gridValues = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Cadastros por dia nos últimos 30 dias">
        {gridValues.map((v) => {
          const y = padTop + innerH - (v / top) * innerH;
          return (
            <g key={v}>
              <line x1={padLeft} x2={W} y1={y} y2={y} stroke="#e3e8ee" strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#8a96a5">
                {v}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.total / top) * innerH;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const y = padTop + innerH - h;
          const isLast = i === data.length - 1;
          return (
            <g key={d.dia}>
              <rect
                x={x}
                y={d.total > 0 ? y : padTop + innerH - 1.5}
                width={barW}
                height={d.total > 0 ? Math.max(h, 2) : 1.5}
                rx={Math.min(3, barW / 2)}
                fill={isLast ? "#0b2545" : d.total > 0 ? "#4a8bd1" : "#cde0f5"}
              >
                <title>{`${label(d.dia)}: ${formatInt(d.total)} cadastro(s)`}</title>
              </rect>
              {i % 5 === 4 || i === 0 ? (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a96a5">
                  {label(d.dia)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        <table>
          <caption>Cadastros por dia</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.dia}>
                <th scope="row">{label(d.dia)}</th>
                <td>{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
