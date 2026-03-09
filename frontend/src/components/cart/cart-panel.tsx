import CartItemComponent from '@/components/cart/cart-item'
import type { CartItem } from '@/types'
import { Button } from '../ui/button'
import { Field, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'

type CartPanelProps = {
  items: CartItem[]
  onItemRemove: (productInstanceId: string) => void
  onItemQuantityIncrease: (productInstanceId: string) => void
  onItemQuantityDecrease: (productInstanceId: string) => void
  totalPrice: string
}

function CartPanel({
  items,
  onItemRemove,
  onItemQuantityIncrease,
  onItemQuantityDecrease,
  totalPrice,
}: CartPanelProps) {
  const numItems = items.reduce((acc, curr) => (acc += curr.quantity), 0)

  return (
    <section className="bg-sidebar-accent flex flex-col p-8 self-start">
      <div className="flex flex-row max-w-full justify-between items-center border-b border-b-accent pb-4">
        <h1 className="text-xl">Your Order</h1>
        {numItems > 0 && (
          <span className="uppercase font-mono text-sm text-muted-foreground">
            {`${numItems} item${numItems > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1">
        {items.length <= 0 ? (
          <div className="self-center my-12 font-sans text-center text-sm">
            <div className="text-3xl mb-2">🛒</div>
            <div>Nothing added yet.</div>
            <div>Select items from the left.</div>
          </div>
        ) : (
          items.map((item) => (
            <CartItemComponent
              key={item.id}
              item={item}
              onRemove={onItemRemove}
              onQuantityIncrease={() => onItemQuantityIncrease(item.id)}
              onQuantityDecrease={() => onItemQuantityDecrease(item.id)}
            />
          ))
        )}
      </div>

      <div className="border-t-2 border-accent-foreground pt-4">
        <div className="flex flex-row justify-between items-center mb-4">
          <span className="font-mono uppercase">Total</span>
          <span className="font-serif text-3xl">{totalPrice}</span>
        </div>
        <Field>
          <FieldLabel
            htmlFor="input-field-full-name"
            className="font-mono uppercase text-sm text-muted-foreground"
          >
            Full Name
          </FieldLabel>
          <Input
            id="input-field-full-name"
            type="text"
            placeholder="First Last"
            className="mb-4 font-sans"
          />
        </Field>
        <Field>
          <FieldLabel
            htmlFor="input-field-email"
            className="font-mono uppercase text-sm text-muted-foreground"
          >
            Email Address
          </FieldLabel>
          <Input
            id="input-field-email"
            type="text"
            placeholder="you@example.com"
            className="mb-8 font-sans"
          />
        </Field>
        <Button type="submit" className="font-mono uppercase w-full">
          Submit Order
        </Button>
      </div>
    </section>
  )
}

export default CartPanel
