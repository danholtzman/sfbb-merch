import { useState } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import imgUrl from '../assets/unnamed.jpg'
import ColorSelector from './color-selector'
import SizeSelector from './size-selector'
import { Button } from './ui/button'

type ProductVariant = {
  color: string
  size: string
  imageUrl: string
  price: string
}

type ProductCardProps = {
  name: string
  description: string
  supplierModelId: string
  colors: string[]
  sizes: string[]
  price: string
}

function ProductCard({
  name,
  description,
  supplierModelId,
  colors,
  sizes,
}: ProductCardProps) {
  const [selectedColor, setSelectedColor] = useState(colors[0])
  const [selectedSize, setSelectedSize] = useState(sizes[0])
  return (
    <Card className="w-full p-0">
      <CardContent className="h-full flex flex-row justify-evenly p-0">
        <div
          className="bg-cover bg-center bg-no-repeat min-w-110"
          style={{ backgroundImage: `url(${imgUrl})` }}
        />
        <div className="bg-muted grow p-8">
          <div className="font-mono text-xs">Model {supplierModelId}</div>
          <h1 className="text-xl mb-2">{name}</h1>
          <div className="text-lg text-red-300 mb-8">$28.00</div>
          <form className="font-mono">
            <div className="mb-4">
              <ColorSelector
                colors={colors}
                selectedColor={selectedColor}
                onSelect={(color: string) => setSelectedColor(color)}
              />
            </div>
            <div className="mb-4">
              <SizeSelector
                sizes={sizes}
                selectedSize={selectedSize}
                onSelect={(size: string) => setSelectedSize(size)}
              />
            </div>
            <div className="mb-8">
              <div className="font-mono uppercase text-xs mb-2">Quantity</div>
              <div>
                <Button variant="outline" className="px-4">
                  -
                </Button>
                <span className="mx-4">1</span>
                <Button variant="outline" className="px-4">
                  +
                </Button>
              </div>
            </div>
            <Button className="max-w-full/50 block">+ Add to Order</Button>
          </form>
        </div>
        <div></div>
      </CardContent>
    </Card>
  )
}

export default ProductCard
