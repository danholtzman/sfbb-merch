import { useCallback, useEffect, useState } from 'react'
import CartPanel from '@/components/cart/cart-panel'
import HeroBar from '@/components/layout/hero-bar'
import NavBar from '@/components/layout/nav-bar'
import ProductCard from '@/components/order-form/product-card'
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

  const handleAddToCart = useCallback(
    (productInstance: ProductInstance, quantity: number) => {
      const newCart: CartItem[] = [...cart]
      const matchingCartItemIndex = cart.findIndex(
        (i) => i.id === productInstance.id,
      )

      if (matchingCartItemIndex >= 0) {
        const existingCartItem = newCart[matchingCartItemIndex]
        existingCartItem.quantity += quantity
      } else {
        newCart.push(createCartItem(productInstance, quantity))
      }

      setCart(newCart)
    },
    [cart],
  )

  const handleItemRemove = useCallback(
    (productInstanceId: string) => {
      setCart(cart.filter((i) => i.id !== productInstanceId))
    },
    [cart],
  )

  const handleItemQuantityIncrease = useCallback(
    (productInstanceId: string) => {
      setCart(
        cart.map((item) => {
          if (item.id === productInstanceId) {
            item.quantity = Math.max(0, item.quantity + 1)
            return item
          }

          return item
        }),
      )
    },
    [cart],
  )

  const handleItemQuantityDecrease = useCallback(
    (productInstanceId: string) => {
      let shouldRemoveItem = false
      setCart(
        cart.map((item) => {
          if (item.id === productInstanceId) {
            item.quantity = Math.max(0, item.quantity - 1)

            if (item.quantity <= 0) {
              shouldRemoveItem = true
            }

            return item
          }

          return item
        }),
      )

      if (shouldRemoveItem) {
        handleItemRemove(productInstanceId)
      }
    },
    [cart, handleItemRemove],
  )

  const numberFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })
  const totalPrice = numberFormatter.format(
    cart.reduce<number>((acc, curr) => (acc += curr.price * curr.quantity), 0),
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
                <ProductCard product={product} onAddToCart={handleAddToCart} />
              </li>
            )
          })}
        </ul>
        <CartPanel
          items={cart}
          onItemRemove={handleItemRemove}
          onItemQuantityIncrease={handleItemQuantityIncrease}
          onItemQuantityDecrease={handleItemQuantityDecrease}
          totalPrice={totalPrice}
        />
      </main>
    </div>
  )
}

export default OrderPage
