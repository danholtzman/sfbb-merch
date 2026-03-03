import { useCallback, useEffect, useState } from 'react'
import HeroBar from '@/components/hero-bar'
import NavBar from '@/components/nav-bar'
import ProductCard from '@/components/product-card'

type ProductVariant = {
  color: string
  size: string
  imageUrl: string
  price: string
}

type Product = {
  id: string
  description: string
  name: string
  supplierModelId: string
  variants: ProductVariant[]
}

function getProductVariant(product: Product, color: string, size: string) {}

function OrderPage() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function getSeasons() {
      const res = await fetch('http://localhost:3000/api/seasons')

      if (res.ok) {
        const seasons = await res.json()
        const res2 = await fetch(
          `http://localhost:3000/api/seasons/${seasons[0].id}/products`,
        )
        const products: Product[] = await res2.json()
        setProducts(products)
      }
    }
    getSeasons()
  }, [])

  return (
    <div className="bg-background font-serif flex flex-col">
      <NavBar />
      <HeroBar />
      <main className="bg-background grid grid-cols-1 xl:grid-cols-3 flex-1">
        <ul className="p-8 col-span-2 grid gap-6 flex-wrap">
          {products.map((product) => {
            const colors = [
              ...new Set(product.variants.map((variant) => variant.color)),
            ]
            const sizes = [
              ...new Set(product.variants.map((variant) => variant.size)),
            ]
            return (
              <li key={product.id}>
                <ProductCard
                  name={product.name}
                  description={product.description}
                  supplierModelId={product.supplierModelId}
                  colors={colors}
                  sizes={sizes}
                  price={'$29.99'}
                  imageUrl={product.variants[0].imageUrl}
                />
              </li>
            )
          })}
        </ul>
        <section className="p-8 bg-sidebar-accent">
          <h1 className="uppercase font-mono text-sm pb-4 border-b border-b-accent">
            Your Order
          </h1>
        </section>
      </main>
    </div>
  )
}

export default OrderPage
