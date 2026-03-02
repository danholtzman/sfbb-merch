type ColorSelectorProps = {
  colors: string[]
  selectedColor: string
  onSelect: (color: string) => void
}

function ColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ColorSelectorProps) {
  return (
    <div className="flex gap-2">
      {colors.map((color) => {
        return (
          <button
            key={color}
            type="button"
            className={`${color === selectedColor ? 'ring-2' : ''} w-4 h-4 rounded-full inline-block cursor-pointer`}
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
          />
        )
      })}
    </div>
  )
}

export default ColorSelector
