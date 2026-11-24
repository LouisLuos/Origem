import { apiRequest } from './api'

export type Mode = 'sequential' | 'parallel'
export interface Sample {
  mode: Mode
  workers: number
  catalog_size: number
  processed_targets: number
  data_source: string
  is_synthetic: boolean
  compute_ms: number
  catalog_fetch_ms: number
  gateway_ms: number
  client_ms: number
  result_digest: string
  input_digest: string
}

export const repetitions = 5
export const totalSamples = (repetitions + 1) * 2

export async function compare(
  size: string,
  workers: number,
  signal: AbortSignal,
  progress: (completed: number, round: number, mode: Mode) => void,
) {
  const measured: Sample[] = []
  let baseline: Sample | undefined
  let completed = 0
  for (let round = 0; round <= repetitions; round++) {
    const modes: Mode[] = round % 2 ? ['parallel', 'sequential'] : ['sequential', 'parallel']
    for (const mode of modes) {
      progress(completed, round, mode)
      const params = new URLSearchParams({ mode, workers: String(mode === 'sequential' ? 1 : workers) })
      if (size) params.set('size', size)
      const start = performance.now()
      const sample = await apiRequest<Sample>(`/laboratorio/amostra?${params}`, {
        method: 'POST',
        signal,
      })
      sample.client_ms = performance.now() - start
      baseline ??= sample
      if (sample.input_digest !== baseline.input_digest || sample.data_source !== baseline.data_source) {
        throw new Error(
          'O acervo mudou durante a comparação. Execute novamente para medir uma carga idêntica.',
        )
      }
      if (!sample.result_digest || sample.result_digest !== baseline.result_digest) {
        throw new Error('Os digests dos resultados divergiram. Comparação descartada.')
      }
      if (round > 0) measured.push(sample)
      completed++
    }
  }
  return measured
}

export type Duration = 'compute_ms' | 'catalog_fetch_ms' | 'gateway_ms' | 'client_ms'
export function median(samples: Sample[], mode: Mode, key: Duration) {
  const values = samples
    .filter((sample) => sample.mode === mode)
    .map((sample) => sample[key])
    .sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}
