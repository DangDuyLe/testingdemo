import { NextResponse } from "next/server";
import neo4j, { Integer } from "neo4j-driver";

// Log Neo4j environment variables (for debugging)
console.log("NEO4J_URI:", process.env.NEO4J_URI?.slice(0, 20) + "...");
console.log("NEO4J_USERNAME:", process.env.NEO4J_USERNAME);
console.log("NEO4J_PASSWORD:", process.env.NEO4J_PASSWORD ? "***" : "missing");

// Validate environment variables
if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  throw new Error("Missing Neo4j environment configuration");
}

// Initialize Neo4j driver with connection pooling
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  { disableLosslessIntegers: true } // Safely handle large numbers
);

// Utility function to safely convert Neo4j numbers to JavaScript numbers
const neo4jNumberToJS = (value: any): number => {
  if (neo4j.isInt(value)) {
    return value.toNumber(); // Convert Neo4j Integer to JS number
  }
  if (typeof value === "number") {
    return value; // Already a JS number
  }
  return Number(value) || 0; // Fallback for invalid values
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Validate Ethereum address format
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Valid Ethereum address required" },
        { status: 400 }
      );
    }

    // Sanitize pagination parameters
    const safePage = Math.max(1, isNaN(page) ? 1 : page); // Ensure page >= 1
    const safeLimit = Math.min(Math.max(1, isNaN(limit) ? 50 : limit), 100); // Limit between 1 and 100
    const skip = (safePage - 1) * safeLimit; // Calculate skip value

    const session = driver.session();
    try {
      // Execute the Cypher query
      const result = await session.executeRead(async (tx) => {
        return tx.run(
          `MATCH (wallet)-[tx:Transfer]-(other)
           WHERE wallet.addressId = $address
           RETURN wallet, tx, other
           SKIP $skip
           LIMIT $limit`,
          {
            address,
            skip: neo4j.int(skip), // Convert to Neo4j integer
            limit: neo4j.int(safeLimit), // Convert to Neo4j integer
          }
        );
      });

      // Process and convert Neo4j records to plain JavaScript objects
      const transactions = result.records.map((record) => {
        const wallet = record.get("wallet").properties;
        const tx = record.get("tx").properties;
        const other = record.get("other").properties;

        return {
          wallet: {
            ...wallet,
            // Convert any numeric wallet properties if needed
          },
          transaction: {
            ...tx,
            value: neo4jNumberToJS(tx.value), // Safely convert value
            // Convert other numeric transaction properties if needed
          },
          counterparty: {
            ...other,
            // Convert any numeric counterparty properties if needed
          },
        };
      });

      // Return the response with pagination metadata
      return NextResponse.json({
        address,
        page: safePage,
        limit: safeLimit,
        total: transactions.length,
        transactions,
      });
    } finally {
      await session.close(); // Always close the session
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}