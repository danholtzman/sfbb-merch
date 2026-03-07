import { useEffect, useState } from 'react'
import Cart from '@/components/cart'
import HeroBar from '@/components/hero-bar'
import NavBar from '@/components/nav-bar'
import ProductCard from '@/components/product-card'
import type { Product } from '@/types'

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
            return (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            )
          })}
        </ul>
        <Cart />
      </main>
    </div>
  )
}

export default OrderPage
