'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, Cpu, Play } from 'lucide-react'
import { Button, Container } from '@/design-system'
import { ErrorBlock } from '@/components/AsyncState'
import {
  compare,
  median,
  repetitions,
  totalSamples,
  type Duration,
  type Sample,
} from '@/services/benchmarkService'

const format = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const modeNames = { sequential: 'Sequencial', parallel: 'Paralelo' }
const times: [Duration, string][] = [
  ['compute_ms', 'Processamento algorítmico'],
  ['catalog_fetch_ms', 'Busca do catálogo'],
  ['gateway_ms', 'Chamada entre serviços'],
  ['client_ms', 'Latência do cliente'],
]
const selectStyle = 'mt-2 block w-full border border-border bg-surface px-3 py-3 text-sm font-medium'
const panel = 'border border-border bg-surface p-5 sm:p-8'

function Results({ samples }: { samples: Sample[] }) {
  const first = samples[0]
  const parallel = samples.find((sample) => sample.mode === 'parallel')!
  const seq = median(samples, 'sequential', 'compute_ms')
  const par = median(samples, 'parallel', 'compute_ms')
  const speedup = seq / par
  const max = Math.max(seq, par, median(samples, 'sequential', 'client_ms'), median(samples, 'parallel', 'client_ms'))
  const source = first.data_source.includes('postgresql') ? 'PostgreSQL + acervo local' : 'Acervo local'
  return (
    <div className="space-y-6" aria-label="Resultados da comparação">
      <section className={panel}>
        <h2 className="text-2xl font-semibold">Resultado da comparação</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {first.is_synthetic
            ? 'Catálogo sintético · expansão determinística do acervo'
            : 'Acervo atual'}{' '}
          · {source} · {first.processed_targets} produtos por lote
        </p>
        <dl className="my-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Speedup de cálculo', format(speedup) + '×'],
            ['Eficiência', format((100 * speedup) / parallel.workers) + '%'],
            ['Workers paralelos', parallel.workers],
          ].map(([label, value]) => (
            <div key={label} className="bg-creme p-4">
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd className="mt-2 text-3xl font-semibold text-aubergine">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mb-5 grid gap-5 md:grid-cols-2">
          {([
            ['Cálculo', seq, par],
            ['Requisição completa', median(samples, 'sequential', 'client_ms'), median(samples, 'parallel', 'client_ms')],
          ] as const).map(([title, sequential, parallelTime]) => (
            <figure key={title}>
              <figcaption className="mb-3 font-semibold">{title}</figcaption>
              {([['Sequencial', sequential], ['Paralelo', parallelTime]] as const).map(([label,value]) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-sm"><span>{label}</span><strong>{format(value)} ms</strong></div>
                  <div className="mt-1 h-3 bg-creme">
                    <div className={label === 'Paralelo' ? 'h-full bg-terracota' : 'h-full bg-aubergine'}
                      style={{width: (100 * value) / max + '%'}} />
                  </div>
                </div>
              ))}
            </figure>
          ))}
          <p className="text-xs text-ink-soft md:col-span-2">Escala comum de 0 a {format(max)} ms. Cada barra representa a mediana de cinco medições.</p>
        </div>
        <p className="border-l-2 border-terracota pl-3 text-sm">
          {speedup > 1
            ? `O paralelo reduziu o tempo mediano de cálculo em ${format(100 * (1 - par / seq))}% nesta execução.`
            : 'Nesta execução, dividir o lote entre processos não reduziu o tempo. A distribuição de tarefas, a serialização e a sincronização também têm custo.'}
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Tempos do percurso distribuído</h2>
        <p className="my-3 text-sm text-ink-soft">
          O cliente mede a requisição completa. Dentro dela, o Catalog aguarda o Recommendation, que
          busca produtos e cestas antes do cálculo. Os intervalos se sobrepõem.
        </p>
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr>
              <th>Mediana</th>
              <th>Sequencial</th>
              <th>Paralelo</th>
            </tr>
          </thead>
          <tbody>
            {times.map(([key, label]) => (
              <tr key={key} className="border-t border-border">
                <th className="py-3 font-normal">{label}</th>
                {(['sequential', 'parallel'] as const).map((mode) => (
                  <td key={mode}>{format(median(samples, mode, key))} ms</td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-border">
              <th className="py-3 font-normal">
                Throughput de cálculo
                <br />
                (produtos/s)
              </th>
              <td>{format((first.processed_targets * 1000) / seq)}</td>
              <td>{format((first.processed_targets * 1000) / par)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <details className={panel}>
        <summary className="cursor-pointer font-semibold">
          Resultados equivalentes · conferir digests e amostras
        </summary>
        <div className="mt-4 space-y-3 text-sm">
          <p>SHA-256 da carga e dos resultados conferidos nas {totalSamples} chamadas.</p>
          {(
            [
              ['Carga comum', first.input_digest],
              ['Resultado sequencial', samples.find((s) => s.mode === 'sequential')!.result_digest],
              ['Resultado paralelo', parallel.result_digest],
            ] as const
          ).map(([label, digest]) => (
            <p key={label}>
              {label}
              <code className="block break-all text-xs">{digest}</code>
            </p>
          ))}
          <ol className="list-decimal space-y-1 pl-6">
            {samples.map((s, i) => (
              <li key={i}>
                {modeNames[s.mode]} · cálculo {format(s.compute_ms)} ms · cliente {format(s.client_ms)}{' '}
                ms
              </li>
            ))}
          </ol>
        </div>
      </details>
    </div>
  )
}

export function PerformanceLab() {
  const [size, setSize] = useState('')
  const [workers, setWorkers] = useState(4)
  const [step, setStep] = useState<{ done: number; label: string } | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function run() {
    if (controller.current) return
    const task = new AbortController()
    controller.current = task
    setError('')
    setSamples([])
    try {
      const result = await compare(size, workers, task.signal, (done, round, mode) =>
        setStep({
          done,
          label:
            (round ? `Repetição ${round} de ${repetitions}` : 'Aquecimento') + ' · ' + modeNames[mode],
        }),
      )
      if (!task.signal.aborted) setSamples(result)
    } catch (reason) {
      if (!task.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Falha na medição do lote.')
    } finally {
      controller.current = null
      if (!task.signal.aborted) setStep(null)
    }
  }
  return (
    <main id="main-content" className="pb-20 pt-28 sm:pt-32">
      <Container className="max-w-5xl space-y-6">
        <header className="border-b border-border pb-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-terracota-600">
            <Activity size={17} /> FCCPD · Unidade 2
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">Laboratório de desempenho</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Compare o cálculo de recomendações do Origem em um único processo e em um pool de processos
            paralelos.
          </p>
        </header>
        <section className={panel}>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Cpu size={20} /> Configuração do ensaio
          </h2>
          <div className="my-5 grid items-end gap-4 sm:grid-cols-[2fr_1fr_auto]">
            <label className="text-sm font-semibold">
              Catálogo
              <select
                aria-label="Catálogo"
                className={selectStyle}
                disabled={!!step}
                value={size}
                onChange={(e) => {
                  setSize(e.target.value)
                  setSamples([])
                  setError('')
                }}
              >
                <option value="">Acervo atual</option>
                {[200, 500, 1000].map((n) => (
                  <option key={n} value={n}>
                    Sintético · {n} produtos
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Workers paralelos
              <select
                aria-label="Workers paralelos"
                className={selectStyle}
                disabled={!!step}
                value={workers}
                onChange={(e) => {
                  setWorkers(Number(e.target.value))
                  setSamples([])
                  setError('')
                }}
              >
                {[2, 4, 8].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <Button variant="primary" onClick={run} disabled={!!step}>
              <Play size={16} /> {step ? 'Medindo…' : 'Executar comparação'}
            </Button>
          </div>
          <p className="text-sm text-ink-soft">
            Um aquecimento e cinco medições por modo, em ordem alternada. O sequencial usa um worker.
          </p>
          {step && (
            <div role="status" className="mt-4">
              <span className="text-sm">
                {step.label} · {step.done}/{totalSamples} concluídas
              </span>
              <progress
                aria-label="Chamadas concluídas"
                className="block w-full accent-terracota"
                value={step.done}
                max={totalSamples}
              />
            </div>
          )}
        </section>
        <section className="bg-aubergine p-5 text-creme-50 sm:p-7">
          <h2 className="font-semibold text-creme-50">Comunicação entre serviços</h2>
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {['Frontend', 'Catalog Service', 'Recommendation Service', 'Catalog Service'].map(
              (name, i) => (
                <li className="flex items-center gap-2" key={i}>
                  {i > 0 && <ArrowRight size={15} aria-hidden />}
                  <span className="border border-creme/30 px-3 py-2">{name}</span>
                </li>
              ),
            )}
          </ol>
          <p className="mt-4 text-sm">
            O Frontend solicita um lote. O Catalog encaminha a chamada ao Recommendation, que consulta o
            catálogo por HTTP e calcula as recomendações.
          </p>
        </section>
        {error && <ErrorBlock message={error} onRetry={run} />}
        {samples.length > 0 && <Results samples={samples} />}
      </Container>
    </main>
  )
}
