import { ThemeProvider } from '@/components/theme-provider'
import OrderPage from '@/pages/order-page'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="sfbb-merch-ui-theme">
      {/* <ThemeToggle /> */}
      <OrderPage />
    </ThemeProvider>
  )
}

export default App
