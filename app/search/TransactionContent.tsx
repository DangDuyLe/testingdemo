'use client'

import { useState, useEffect } from 'react'
import SearchBar from "@/components/SearchBar"
import WalletInfo from "@/components/WalletInfo"
import TransactionGraph from "@/components/TransactionGraph"
import TransactionTable from "@/components/TransactionTable"
import Portfolio from "@/components/Portfolio"
import NFTGallery from "@/components/NFTGallery"
import { useSearchParams } from "next/navigation"
import { 
  SearchData, 
  WalletInfoProps, 
  PortfolioProps, 
  TransactionGraphProps, 
  TransactionTableProps, 
  NFTGalleryProps 
} from '@/lib/types'

export default function Transactions() {
  const searchParams = useSearchParams()
  const address = searchParams.get("address")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SearchData | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!address) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/search?address=${address}`)
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        const json = await response.json()
        setData(json)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [address])

  return (
    <div className="min-h-screen text-white">
      <main className="container mx-auto p-4">
        <div className="mb-8">
          <SearchBar />
        </div>
        
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4">Loading data...</p>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-center p-4 bg-red-100/10 rounded-lg">
            <p>Error: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        )}

        {address && !loading && !error ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <WalletInfo data={data?.walletInfo} />
                <Portfolio data={data?.portfolio} />
              </div>
              <TransactionGraph data={data?.transactions ?? []} />
            </div>
            <TransactionTable data={data?.transactions ?? []} />
            <NFTGallery data={data?.nfts ?? []} />
          </>
        ) : null}

        {!address && !loading && (
          <div className="text-center mt-8">
            <h2 className="text-2xl font-bold mb-4">Welcome to CryptoPath</h2>
            <p className="text-lg">
              Enter an Ethereum address above to explore wallet details, transactions, and NFTs.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
