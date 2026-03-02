import { Button } from './ui/button'

type SizeSelectorProps = {
  sizes: string[]
  selectedSize: string
  onSelect: (color: string) => void
}

function SizeSelector({ sizes, selectedSize, onSelect }: SizeSelectorProps) {
  return (
    <div>
      <div className="font-mono uppercase text-xs mb-2">Size</div>
      <div className="flex gap-2">
        {sizes.map((size) => {
          return (
            <Button
              key={size}
              type="button"
              variant={`${selectedSize === size ? 'default' : 'outline'}`}
              className="px-4"
              onClick={onSelect.bind(undefined, size)}
            >
              {size}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export default SizeSelector
