import { useCallback, useEffect, useState } from 'react'
import CartPanel from '@/components/cart-panel'
import HeroBar from '@/components/hero-bar'
import NavBar from '@/components/nav-bar'
import ProductCard from '@/components/product-card'
import type { CartItem, Product, ProductInstance } from '@/types'

function createCartItem(
  productInstance: ProductInstance,
  quantity: number,
): CartItem {
  return {
    ...productInstance,
    quantity,
  }
}

function OrderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const onAddToCart = useCallback(
    (productInstance: ProductInstance, quantity: number) => {
      setCart([...cart, createCartItem(productInstance, quantity)])
    },
    [cart],
  )

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
                <ProductCard product={product} onAddToCart={onAddToCart} />
              </li>
            )
          })}
        </ul>
        <CartPanel items={cart} />
      </main>
    </div>
  )
}

export default OrderPage
