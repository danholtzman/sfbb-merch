import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

function NavBar() {
  return (
    <nav className="bg-background h-16 px-8 flex flex-row place-content-between items-center shrink-0">
      <h1 className="text-primary">
        <span>Brass & </span>
        <span className="text-accent-foreground">Threads</span>
      </h1>

      <ButtonGroup className="font-mono">
        <Button size="sm" className="text-primary-foreground">
          Order Form
        </Button>
        <Button variant="outline" size="sm">
          Admin
        </Button>
      </ButtonGroup>
    </nav>
  )
}

export default NavBar
