import { prisma } from '../config/database.js';
import { formatTechnique } from '../constants/taxonomy.js';
import { buildArtisanId } from '../utils/string.util.js';
import { isUuid } from '../utils/uuid.util.js';
import { loadCatalogPayload } from './catalogLoader.js';
import { mapPecaParaProdutoPublico } from './pecaVitrine.repository.js';
import type { ProdutoPublico } from './produto.repository.js';

export interface ArtesaoPublico {
  id: string;
  name: string;
  hub: string;
  technique: string;
  bio: string;
  since: number | null;
  photoUrl: string;
  photoAlt: string;
  coverUrl: string;
  coverAlt: string;
  email: string | null;
  pieces: ProdutoPublico[];
}

/**
 * Perfis públicos combinados: registros persistidos no Prisma são a fonte real,
 * enquanto o catálogo legado permanece disponível para compatibilidade durante a migração.
 */
export class ArtesaoRepository {
  async findAll(): Promise<ArtesaoPublico[]> {
    const persisted = await this.findAllPersisted();

    const data = loadCatalogPayload();
    const seen = new Set(persisted.map((artisan) => buildArtisanId(artisan.name)));

    for (const item of data.produtos ?? []) {
      const trimmedName = item.artesao.trim();
      const legacyId = buildArtisanId(trimmedName);
      if (seen.has(legacyId)) continue;

      seen.add(legacyId);
      persisted.push({
        id: legacyId,
        name: trimmedName,
        hub: item.polo,
        technique: formatTechnique(item.tecnica),
        bio: '',
        since: null,
        photoUrl: '',
        photoAlt: trimmedName,
        coverUrl: '',
        coverAlt: trimmedName,
        email: null,
        pieces: [],
      });
    }

    return persisted;
  }

  async findById(id: string): Promise<ArtesaoPublico | null> {
    if (isUuid(id)) {
      const persisted = await this.findPersistedById(id);
      if (persisted) return persisted;
    }

    const all = await this.findAll();
    return all.find((artisan) => artisan.id === id) ?? null;
  }

  private async findAllPersisted(): Promise<ArtesaoPublico[]> {
    try {
      const artesaos = await prisma.artesao.findMany({
        where: { usuario: { status: 'ATIVO' } },
        select: {
          id: true,
          biografiaCultural: true,
          tecnicaPrincipal: true,
          anoInicio: true,
          fotoUrl: true,
          fotoAlt: true,
          coverUrl: true,
          coverAlt: true,
          usuario: { select: { nome: true, email: true } },
          atelie: { select: { poloCultural: true, nomeComercial: true } },
        },
        orderBy: { criadoEm: 'desc' },
      });

      return artesaos.map((artisan) => ({
        id: artisan.id,
        name: artisan.usuario.nome,
        hub: artisan.atelie?.poloCultural ?? '',
        technique: artisan.tecnicaPrincipal ?? '',
        bio: artisan.biografiaCultural,
        since: artisan.anoInicio,
        photoUrl: artisan.fotoUrl ?? '',
        photoAlt: artisan.fotoAlt ?? artisan.usuario.nome,
        coverUrl: artisan.coverUrl ?? '',
        coverAlt: artisan.coverAlt ?? artisan.atelie?.nomeComercial ?? artisan.usuario.nome,
        email: null,
        pieces: [],
      }));
    } catch (err) {
      console.error('❌ Falha ao carregar artesãos persistidos:', err);
      return [];
    }
  }

  private async findPersistedById(id: string): Promise<ArtesaoPublico | null> {
    const artisan = await prisma.artesao.findFirst({
      where: { id, usuario: { status: 'ATIVO' } },
      select: {
        id: true,
        biografiaCultural: true,
        tecnicaPrincipal: true,
        anoInicio: true,
        fotoUrl: true,
        fotoAlt: true,
        coverUrl: true,
        coverAlt: true,
        usuario: { select: { nome: true } },
        atelie: {
          select: {
            id: true,
            poloCultural: true,
            nomeComercial: true,
            pecas: {
              where: { status: 'DISPONIVEL', quantidadeEstoque: { gt: 0 } },
              select: {
                id: true,
                atelieId: true,
                titulo: true,
                descricao: true,
                tipologia: true,
                preco: true,
                quantidadeEstoque: true,
                status: true,
                atelie: { select: { poloCultural: true, artesao: { select: { id: true, usuario: { select: { nome: true } } } } } },
                fotos: { select: { url: true, isPrincipal: true }, orderBy: { ordem: 'asc' } },
              },
              orderBy: { criadoEm: 'desc' },
            },
          },
        },
      },
    });

    if (!artisan) return null;

    const pieces = (artisan.atelie?.pecas ?? []).map((peca) =>
      mapPecaParaProdutoPublico({
        id: peca.id,
        atelieId: peca.atelieId,
        titulo: peca.titulo,
        descricao: peca.descricao,
        tipologia: peca.tipologia,
        preco: peca.preco,
        quantidadeEstoque: peca.quantidadeEstoque,
        status: peca.status,
        atelie: {
          poloCultural: peca.atelie.poloCultural,
          artesao: {
            id: peca.atelie.artesao.id,
            usuario: { nome: peca.atelie.artesao.usuario.nome },
          },
        },
        fotos: peca.fotos,
      }),
    );

    return {
      id: artisan.id,
      name: artisan.usuario.nome,
      hub: artisan.atelie?.poloCultural ?? '',
      technique: artisan.tecnicaPrincipal ?? pieces[0]?.technique ?? '',
      bio: artisan.biografiaCultural,
      since: artisan.anoInicio,
      photoUrl: artisan.fotoUrl ?? '',
      photoAlt: artisan.fotoAlt ?? artisan.usuario.nome,
      coverUrl: artisan.coverUrl ?? '',
      coverAlt: artisan.coverAlt ?? artisan.atelie?.nomeComercial ?? artisan.usuario.nome,
      email: null,
      pieces,
    };
  }
}

export const artesaoRepository = new ArtesaoRepository();
