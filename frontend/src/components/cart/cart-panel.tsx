import CartItemComponent from '@/components/cart/cart-item'
import type { CartItem } from '@/types'

type CartPanelProps = {
  items: CartItem[]
  onItemRemove: (productInstanceId: string) => void
  onItemQuantityIncrease: (productInstanceId: string) => void
  onItemQuantityDecrease: (productInstanceId: string) => void
}

function CartPanel({
  items,
  onItemRemove,
  onItemQuantityIncrease,
  onItemQuantityDecrease,
}: CartPanelProps) {
  const numItems = items.reduce((acc, curr) => (acc += curr.quantity), 0)
  return (
    <section className="bg-sidebar-accent">
      <div className="flex flex-row max-w-full justify-between items-center border-b border-b-accent px-8 py-4">
        <h1 className="text-xl">Your Order</h1>
        {numItems > 0 && (
          <span className="uppercase font-mono text-sm text-muted-foreground">
            {`${numItems} item${numItems > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <div className="flex flex-col px-8">
        {items.map((item) => (
          <CartItemComponent
            key={item.id}
            item={item}
            onRemove={onItemRemove}
            onQuantityIncrease={() => onItemQuantityIncrease(item.id)}
            onQuantityDecrease={() => onItemQuantityDecrease(item.id)}
          />
        ))}
      </div>
    </section>
  )
}

export default CartPanel
