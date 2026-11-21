'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { ImagePlus, ShieldAlert, Star, X } from 'lucide-react'
import { Button, Input, cn } from '@/design-system'
import {
  PIECE_MAX_PHOTOS,
  PIECE_MIN_PHOTOS,
  PIECE_PHOTO_TYPES,
  classifyPieceError,
  pieceService,
  pieceTypologies,
  readFileAsBase64,
  type ClassifiedPieceError,
  type CreatedPiece,
  type PiecePhotoType,
} from '@/services/pieceService'
import {
  parseDecimal,
  validatePhotoFile,
  validatePieceDraft,
  type PieceDraftErrors,
  type PieceDraftField,
} from '@/utils/pieceValidation'

interface PieceCatalogFormProps {
  /** Ateliê confirmado pelo servidor com permissão GERENCIAR_CATALOGO; `null` bloqueia a publicação. */
  readonly atelieId: string | null
  /** Motivo exibido quando não há ateliê autorizado para publicar. */
  readonly unavailableReason?: string
  readonly onCancel: () => void
  readonly onPublished: (piece: CreatedPiece) => void
}

interface SelectedPhoto {
  readonly key: string
  readonly file: File
  readonly previewUrl: string
}

type TextField = 'title' | 'description' | 'typology' | 'price' | 'weight' | 'length' | 'width' | 'height'

const emptyDraft: Record<TextField, string> = {
  title: '',
  description: '',
  typology: pieceTypologies[0],
  price: '',
  weight: '',
  length: '',
  width: '',
  height: '',
}

const controlClass =
  'w-full border border-border bg-surface px-5 py-2.5 text-base text-ink placeholder:text-ink-soft/60 transition-colors focus:border-terracota'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  )
}

export function PieceCatalogForm({ atelieId, unavailableReason, onCancel, onPublished }: PieceCatalogFormProps) {
  const baseId = useId()
  const fieldId = (field: PieceDraftField) => `${baseId}-${field}`
  const errorId = (field: PieceDraftField) => `${baseId}-${field}-erro`

  const [draft, setDraft] = useState(emptyDraft)
  const [isFragile, setIsFragile] = useState(false)
  const [photos, setPhotos] = useState<SelectedPhoto[]>([])
  const [principalIndex, setPrincipalIndex] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<PieceDraftErrors>({})
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ClassifiedPieceError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Libera as URLs de pré-visualização ao desmontar o formulário.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), [])

  const setField = (field: TextField) => (event: { target: { value: string } }) => {
    const { value } = event.target
    setDraft((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleAddPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const rejected: string[] = []
    const accepted: SelectedPhoto[] = []
    for (const file of files) {
      const problem = validatePhotoFile(file)
      if (problem) {
        rejected.push(problem)
        continue
      }
      if (photos.length + accepted.length >= PIECE_MAX_PHOTOS) {
        rejected.push(`Limite de ${PIECE_MAX_PHOTOS} fotos por peça atingido.`)
        break
      }
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted])
      setFieldErrors((prev) => ({ ...prev, photos: undefined }))
    }
    setPhotoNotice(rejected.length > 0 ? rejected.join(' ') : null)
  }

  const handleRemovePhoto = (index: number) => {
    const removed = photos[index]
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    setPhotos((prev) => prev.filter((_, current) => current !== index))
    setPrincipalIndex((current) => (current === index ? 0 : current > index ? current - 1 : current))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)

    const errors = validatePieceDraft({ ...draft, isFragile, photoCount: photos.length })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    if (!atelieId) {
      setSubmitError({
        kind: 'forbidden',
        message: unavailableReason ?? 'Nenhum ateliê com permissão de catálogo foi confirmado pelo servidor.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const fotos = await Promise.all(
        photos.map(async (photo) => ({
          tipoMime: photo.file.type as PiecePhotoType,
          conteudoBase64: await readFileAsBase64(photo.file),
        })),
      )
      const created = await pieceService.create(atelieId, {
        titulo: draft.title.trim(),
        descricao: draft.description.trim(),
        tipologia: draft.typology,
        preco: parseDecimal(draft.price),
        pesoGramas: parseDecimal(draft.weight),
        comprimentoCm: parseDecimal(draft.length),
        larguraCm: parseDecimal(draft.width),
        alturaCm: parseDecimal(draft.height),
        isFragil: isFragile,
        fotos,
        indiceFotoPrincipal: principalIndex,
      })
      onPublished(created)
    } catch (reason) {
      setSubmitError(classifyPieceError(reason))
    } finally {
      setIsSubmitting(false)
    }
  }

  const describedBy = (field: PieceDraftField) => (fieldErrors[field] ? errorId(field) : undefined)

  const numberField = (field: 'price' | 'weight' | 'length' | 'width' | 'height', label: string, placeholder: string): ReactNode => (
    <div className="flex flex-col gap-1.5">
      <Input
        id={fieldId(field)}
        label={label}
        inputMode="decimal"
        value={draft[field]}
        onChange={setField(field)}
        placeholder={placeholder}
        aria-invalid={Boolean(fieldErrors[field])}
        aria-describedby={describedBy(field)}
        className="py-2.5"
      />
      <FieldError id={errorId(field)} message={fieldErrors[field]} />
    </div>
  )

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Nova peça"
      aria-busy={isSubmitting}
      className="mb-10 flex flex-col gap-4 border border-border bg-aubergine-400/10 p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Nova peça</h2>

      {!atelieId && (
        <div role="status" className="flex items-start gap-3 border border-border bg-surface p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-ink-soft">
            {unavailableReason ??
              'A publicação exige um ateliê com permissão de catálogo confirmado pelo servidor.'}{' '}
            Você pode preencher os dados, mas a peça não será publicada enquanto o vínculo não for confirmado.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Input
            id={fieldId('title')}
            label="Título da peça"
            value={draft.title}
            onChange={setField('title')}
            placeholder="Boneco de Barro “Casal de Feira”"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={describedBy('title')}
            className="py-2.5"
          />
          <FieldError id={errorId('title')} message={fieldErrors.title} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId('typology')} className="text-sm font-medium text-ink-soft">
            Tipologia
          </label>
          <select
            id={fieldId('typology')}
            value={draft.typology}
            onChange={setField('typology')}
            aria-invalid={Boolean(fieldErrors.typology)}
            aria-describedby={describedBy('typology')}
            className={controlClass}
          >
            {pieceTypologies.map((typology) => (
              <option key={typology}>{typology}</option>
            ))}
          </select>
          <FieldError id={errorId('typology')} message={fieldErrors.typology} />
        </div>

        {numberField('price', 'Preço (R$)', '189,00')}
        {numberField('weight', 'Peso embalado (g)', 'mínimo 50')}
        {numberField('length', 'Comprimento (cm)', '30')}
        {numberField('width', 'Largura (cm)', '20')}
        {numberField('height', 'Altura (cm)', '25')}

        <label className="flex cursor-pointer items-center gap-3 self-end pb-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={isFragile}
            onChange={(event) => setIsFragile(event.target.checked)}
            className="h-4 w-4 accent-terracota"
          />
          Peça Frágil (Cerâmica/Barro)
        </label>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={fieldId('description')} className="text-sm font-medium text-ink-soft">
            Descrição
          </label>
          <textarea
            id={fieldId('description')}
            rows={3}
            value={draft.description}
            onChange={setField('description')}
            placeholder="Conte como a peça é feita, materiais e técnica."
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={describedBy('description')}
            className={controlClass}
          />
          <FieldError id={errorId('description')} message={fieldErrors.description} />
        </div>

        <fieldset className="flex flex-col gap-3 sm:col-span-2" aria-describedby={describedBy('photos')}>
          <legend className="pb-1.5 text-sm font-medium text-ink-soft">
            Fotos da peça (mínimo {PIECE_MIN_PHOTOS}, máximo {PIECE_MAX_PHOTOS}; JPEG ou PNG até 5 MB)
          </legend>

          {photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {photos.map((photo, index) => (
                <li key={photo.key} className="flex flex-col gap-1.5">
                  <div
                    className={cn(
                      'relative border-2',
                      index === principalIndex ? 'border-terracota' : 'border-border',
                    )}
                  >
                    <img src={photo.previewUrl} alt={`Pré-visualização da foto ${index + 1}`} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      aria-label={`Remover foto ${index + 1}`}
                      className="absolute right-1 top-1 cursor-pointer bg-surface/90 p-1 text-ink hover:text-danger"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                    <input
                      type="radio"
                      name={`${baseId}-principal`}
                      checked={index === principalIndex}
                      onChange={() => setPrincipalIndex(index)}
                      className="accent-terracota"
                    />
                    {index === principalIndex ? (
                      <span className="inline-flex items-center gap-1 font-medium text-ink">
                        <Star className="h-3 w-3" aria-hidden="true" /> Foto de capa
                      </span>
                    ) : (
                      'Usar como capa'
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}

          {photos.length < PIECE_MAX_PHOTOS && (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 border border-dashed border-border px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-terracota hover:text-ink">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Adicionar fotos
              <input
                type="file"
                accept={PIECE_PHOTO_TYPES.join(',')}
                multiple
                onChange={handleAddPhotos}
                className="sr-only"
              />
            </label>
          )}

          {photoNotice && <p className="text-sm text-warning">{photoNotice}</p>}
          <FieldError id={errorId('photos')} message={fieldErrors.photos} />
        </fieldset>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-danger">
          {submitError.message}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Publicando…' : 'Publicar Peça'}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
