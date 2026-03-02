import { useEffect, useState } from 'react'
import HeroBar from '@/components/hero-bar'
import NavBar from '@/components/nav-bar'
import ProductCard from '@/components/product-card'

type Product = {
  id: string
  description: string
  name: string
  supplierModelId: string
  variants: []
}

function OrderPage() {
  const [products, setProducts] = useState<Product[]>([])
  // const colors = productVariants.map((variant) => variant.color)
  // const sizes = productVariants.map((variant) => variant.size)
  // const prices = productVariants.map((variant) => variant.price)

  useEffect(() => {
    async function getSeasons() {
      const res = await fetch('http://localhost:3000/api/seasons')

      if (res.ok) {
        const seasons = await res.json()
        const res2 = await fetch(
          `http://localhost:3000/api/seasons/${seasons[0].id}/products`,
        )
        const products = await res2.json()
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
            return (
              <li key={product.id}>
                <ProductCard
                  name={product.name}
                  description={product.description}
                  supplierModelId={product.supplierModelId}
                  colors={['red', 'blue', 'green']}
                  sizes={['S', 'M', 'L', 'XL', '2XL']}
                  price="$29.99"
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
