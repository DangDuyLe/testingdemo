import { NextResponse } from "next/server";
import neo4j from "neo4j-driver";

// Log Neo4j environment variables (for debugging)
console.log("NEO4J_URI:", process.env.NEO4J_URI?.slice(0, 20) + "...");
console.log("NEO4J_USERNAME:", process.env.NEO4J_USERNAME);
console.log("NEO4J_PASSWORD:", process.env.NEO4J_PASSWORD ? "***" : "missing");

// Validate environment variables
if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  throw new Error("Missing Neo4j environment configuration");
}

// Initialize driver with connection pool
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  { disableLosslessIntegers: true } // Handle big numbers safely
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Validate address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Valid Ethereum address required" },
        { status: 400 }
      );
    }

    // Sanitize pagination parameters
    const safePage = Math.max(1, isNaN(page) ? 1 : page);
    const safeLimit = Math.min(Math.max(1, isNaN(limit) ? 50 : limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const session = driver.session();
    try {
      const result = await session.executeRead(async tx => {
        return tx.run(
          `MATCH (wallet)-[tx:Transfer]-(other)
           WHERE wallet.addressId = $address
           RETURN wallet, tx, other
           SKIP $skip
           LIMIT $limit`,
          {
            address,
            skip: neo4j.int(skip),
            limit: neo4j.int(safeLimit)
          }
        );
      });

      // Convert Neo4j types to plain JS objects
      const transactions = result.records.map(record => ({
        wallet: record.get("wallet").properties,
        transaction: {
          ...record.get("tx").properties,
          // Convert Neo4j Integer to JS number
          value: record.get("tx").properties.value.toNumber()
        },
        counterparty: record.get("other").properties
      }));

      return NextResponse.json({
        address,
        page: safePage,
        limit: safeLimit,
        total: transactions.length,
        transactions
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}