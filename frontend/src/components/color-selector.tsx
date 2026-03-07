import type { Color } from '@/types'

type ColorSelectorProps = {
  colors: Color[]
  selectedColor: Color
  onSelect: (color: Color) => void
}

function ColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ColorSelectorProps) {
  return (
    <div className="flex gap-4">
      {/* TODO: Color name on hover */}
      {colors.map((color) => {
        return (
          <button
            key={color.hexCode}
            type="button"
            className={`${color.hexCode === selectedColor.hexCode ? 'ring-2' : ''} w-8 h-8 rounded-full inline-block cursor-pointer`}
            style={{ backgroundColor: color.hexCode }}
            onClick={() => onSelect(color)}
          />
        )
      })}
    </div>
  )
}

export default ColorSelector
