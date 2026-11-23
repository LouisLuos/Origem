export interface Address {
  street: string
  neighborhood: string
  city: string
  state: string
}

interface ViaCepResponse {
  erro?: boolean
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

/** Consulta de endereço por CEP no ViaCEP. */
export const addressService = {
  /** Devolve `null` se o CEP não existir; rejeita se o serviço estiver indisponível. */
  async lookup(zipDigits: string, signal?: AbortSignal): Promise<Address | null> {
    const response = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`, { signal })
    if (!response.ok) throw new Error('Não foi possível buscar o CEP.')
    const data = (await response.json()) as ViaCepResponse
    if (data.erro) return null
    return { street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf }
  },
}
