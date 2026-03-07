import type { CartItem as CartItemType } from '@/types'
import { Button } from './ui/button'

type CartItemProps = {
  item: CartItemType
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function CartItem({ item }: CartItemProps) {
  const perItemPrice = numberFormatter.format(item.price)
  const totalPrice = numberFormatter.format(item.price * item.quantity)

  return (
    <div className="flex flex-row border-b border-b-accent py-4">
      <img src={item.imageUrl} alt="Shirt" className="mr-4 w-24 h-auto" />
      <div className="flex-1">
        <div className="flex flex-row justify-between">
          <span>{item.name}</span>
          <span className="font-mono">{totalPrice}</span>
        </div>
        <div className="flex flex-row justify-between font-mono text-sm text-muted-foreground">
          <div>
            <span
              className="w-2 h-2 rounded-full inline-block mr-2 ring-1"
              style={{ backgroundColor: item.colorHex }}
            ></span>

            <span className="mr-2">{item.colorName}</span>
            <span className="mr-2">·</span>
            <span className="mr-2">{item.size}</span>
          </div>
          {item.quantity > 1 ? <span>{`${perItemPrice} ea`}</span> : null}
        </div>

        {/* {personalization ? (
          <div className="font-mono text-sm">
            <span className="mr-2 text-red-300">Personalization:</span>
            <span>{`"${personalization}"`}</span>
          </div>
        ) : null} */}

        <div className="font-mono text-sm mt-2">
          <span className="mr-2">Quantity:</span>
          <Button variant="outline" className="mr-2 h-6">
            -
          </Button>
          <span className="mr-2">{item.quantity}</span>
          <Button variant="outline" className="h-6">
            +
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="destructive"
        className="font-mono self-center ml-4 w-8 h-8"
      >
        x
      </Button>
    </div>
  )
}

export default CartItem
