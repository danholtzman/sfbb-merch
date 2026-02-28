import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from './components/theme-toggle'
import OrderPage from './pages/order-Page'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sfbb-merch-ui-theme">
      {/* <ThemeToggle /> */}
      <OrderPage />
    </ThemeProvider>
  )
}

export default App
