import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import { monad } from './chain'
import './style.css'

// Get a free project ID at cloud.reown.com for WalletConnect and mobile wallets.
// Browser wallets like MetaMask and Rabby work without one.
const config = getDefaultConfig({
  appName: 'Rio',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'rio-demo-no-walletconnect',
  chains: [monad],
})
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({ accentColor: '#6ff0c0', accentColorForeground: '#07104d', borderRadius: 'large', fontStack: 'system' })}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)
