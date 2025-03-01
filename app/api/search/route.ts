import { NextResponse } from 'next/server'
import { runQuery } from '@/lib/neo4j'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json(
      { error: 'Address parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Cypher query để search transactions
    const query = `
      MATCH (from:Wallet)-[tx:SENT]->(to:Wallet)
      WHERE from.address = $address OR to.address = $address
      RETURN from, tx, to
      ORDER BY tx.timestamp DESC
      LIMIT 100
    `

    const records = await runQuery(query, { address })
    
    const transactions = records.map(record => ({
      from: record.get('from').properties,
      transaction: record.get('tx').properties,
      to: record.get('to').properties
    }))

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Search API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
} 