import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import imgUrl from '../assets/shirt.jpg'
import { Button } from './ui/button'

function ProductCard() {
  return (
    <Card className="w-full p-0">
      <CardContent className="h-full flex flex-row justify-evenly p-0">
        <div
          className="bg-cover bg-center bg-no-repeat min-w-110"
          style={{ backgroundImage: `url(${imgUrl})` }}
        />
        <div className="bg-muted grow p-8">
          <div className="font-mono text-xs">Model #SS-2200</div>
          <h1 className="text-xl mb-2">Short Sleeve Tee</h1>
          <div className="text-lg text-red-300 mb-8">$28.00</div>
          <form className="font-mono">
            <div className="mb-4">
              <div className="font-mono uppercase text-xs mb-2">Color</div>
              <ul className="">
                <li className="inline-block">
                  <button
                    type="button"
                    className="w-4 h-4 bg-purple-500 rounded-full inline-block ring-2 p-1 mr-2 cursor-pointer"
                  />
                </li>
                <li className="inline-block">
                  <button
                    type="button"
                    className="w-4 h-4 bg-red-500 rounded-full inline-block p-1 mr-2 cursor-pointer"
                  />
                </li>
                <li className="inline-block">
                  <button
                    type="button"
                    className="w-4 h-4 bg-green-500 rounded-full inline-block p-1 mr-2 cursor-pointer"
                  />
                </li>
                <li className="inline-block">
                  <button
                    type="button"
                    className="w-4 h-4 bg-blue-500 rounded-full inline-block p-1 mr-2 cursor-pointer"
                  />
                </li>
              </ul>
            </div>
            <div className="mb-4">
              <div className="font-mono uppercase text-xs mb-2">Size</div>
              <ul>
                <li className="inline me-2">
                  <Button variant="outline" className="px-4">
                    S
                  </Button>
                </li>
                <li className="inline me-2">
                  <Button className="px-4">M</Button>
                </li>
                <li className="inline me-2">
                  <Button variant="outline" className="px-4">
                    L
                  </Button>
                </li>
                <li className="inline me-2">
                  <Button variant="outline" className="px-4">
                    XL
                  </Button>
                </li>
                <li className="inline">
                  <Button variant="outline" className="px-4">
                    2XL
                  </Button>
                </li>
              </ul>
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
