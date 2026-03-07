import { Button } from './ui/button'

type CartItemProps = {
  name: string
  perItemPrice?: string
  totalPrice: string
  personalization?: string
  quantity: number
  size: string
  imageUrl: string
}

function CartItem({
  name,
  perItemPrice,
  totalPrice,
  personalization,
  quantity,
  size,
  imageUrl,
}: CartItemProps) {
  return (
    <div className="flex flex-row border-b border-b-accent py-4">
      <img src={imageUrl} alt="Shirt" className="mr-4 w-24 h-auto" />
      <div className="flex-1">
        <div className="flex flex-row justify-between">
          <span>{name}</span>
          <span className="font-mono">{totalPrice}</span>
        </div>
        <div className="flex flex-row justify-between font-mono text-sm text-muted-foreground">
          <div>
            <span className="w-2 h-2 bg-blue-900 rounded-full inline-block mr-2 ring-1"></span>
            {/* TODO: Color name in addition to color hex */}
            <span className="mr-2">Navy</span>
            <span className="mr-2">·</span>
            <span className="mr-2">{size}</span>
          </div>
          {perItemPrice ? <span>{`${perItemPrice} ea`}</span> : null}
        </div>

        {personalization ? (
          <div className="font-mono text-sm">
            <span className="mr-2 text-red-300">Personalization:</span>
            <span>{`"${personalization}"`}</span>
          </div>
        ) : null}

        <div className="font-mono text-sm mt-2">
          <span className="mr-2">Quantity:</span>
          <Button variant="outline" className="mr-2 h-6">
            -
          </Button>
          <span className="mr-2">{quantity}</span>
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
