import { Button } from './ui/button'

type SizeSelectorProps = {
  sizes: string[]
  selectedSize: string
  onSelect: (color: string) => void
}

function SizeSelector({ sizes, selectedSize, onSelect }: SizeSelectorProps) {
  return (
    <div className="flex gap-2">
      {sizes.map((size) => {
        return (
          <Button
            key={size}
            type="button"
            variant={`${selectedSize === size ? 'default' : 'outline'}`}
            className="px-4"
            onClick={() => onSelect(size)}
          >
            {size}
          </Button>
        )
      })}
    </div>
  )
}

export default SizeSelector
