import { Container, ProductCard, SectionHeading, Button } from '@/design-system'
import { featuredProducts } from '@/data/mockProducts'
import { PromoTile } from './PromoTile'

export function FeaturedShowcase() {
  return (
    <section id="vitrine" className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          title="Peças em destaque desta semana"
          description="Selecionadas entre os polos culturais de Pernambuco: cada peça carrega a técnica, a história e a assinatura de quem a fez."
          action={
            <Button variant="outline" size="md">
              Ver vitrine completa
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {featuredProducts.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}

          <PromoTile
            eyebrow="Coleção especial"
            title="Cerâmica do Alto do Moura"
            description="Peças figurativas com até 20% off nesta semana."
            imageUrl="https://picsum.photos/seed/origem-promo-1/500/300"
            imageAlt="Bonecos de barro típicos do Alto do Moura expostos lado a lado"
            tone="terracota"
            className="col-span-2 sm:col-span-1"
          />

          {featuredProducts.slice(4, 7).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}

          <PromoTile
            eyebrow="Junho é mês do artesão"
            title="Frete grátis em compras acima de R$250"
            description="Válido para peças de todos os polos culturais parceiros."
            imageUrl="https://picsum.photos/seed/origem-promo-2/500/300"
            imageAlt="Embalagem artesanal preparada para envio"
            tone="oliva"
            className="col-span-2 sm:col-span-1"
          />

          <ProductCard product={featuredProducts[7]} />
        </div>
      </Container>
    </section>
  )
}
