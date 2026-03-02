import { Button } from './ui/button'

type QuantitySelectorProps = {
  quantity: number
  onAdd: () => void
  onSubtract: () => void
}

function QuantitySelector({
  quantity,
  onAdd,
  onSubtract,
}: QuantitySelectorProps) {
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="px-4"
        onClick={() => onSubtract()}
      >
        -
      </Button>
      <span className="mx-4">{quantity}</span>
      <Button
        type="button"
        variant="outline"
        className="px-4"
        onClick={() => onAdd()}
      >
        +
      </Button>
    </div>
  )
}

export default QuantitySelector
