import { NextResponse } from "next/server";
import neo4j from "neo4j-driver";

const ETHERSCAN_API_URL = "https://api.etherscan.io/api";

// Log Neo4j environment variables (for debugging purposes only)
console.log("Loaded NEO4J_URI:", process.env.NEO4J_URI);
console.log("Loaded NEO4J_USERNAME:", process.env.NEO4J_USERNAME);
console.log("Loaded NEO4J_PASSWORD:", process.env.NEO4J_PASSWORD);

// Ensure all required Neo4j environment variables are present
if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  throw new Error("Missing one or more required Neo4j environment variables (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)");
}

// Initialize the Neo4j driver using the correct environment variables
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const page = searchParams.get("page") || "1";
  const offset = searchParams.get("offset") || "50";

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  // Log ETHERSCAN_API_KEY to verify it's loaded (remove after debugging)
  console.log("Loaded ETHERSCAN_API_KEY:", process.env.ETHERSCAN_API_KEY);

  try {
    // 1) Attempt to fetch transactions from Etherscan
    const response = await fetch(
      `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`
    );

    // Read raw text to check for an HTML error page
    const rawText = await response.text();
    console.log("Raw Etherscan response:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error("Failed to parse JSON from Etherscan. Raw response: " + rawText);
    }

    // Etherscan returns status "1" when successful
    if (data.status !== "1" || !Array.isArray(data.result) || data.result.length === 0) {
      throw new Error("Etherscan returned no data or an error: " + (data.message || "unknown error"));
    }

    // Map Etherscan data to your transaction shape
    const transactions = data.result.map((tx: any) => ({
      id: tx.hash,
      from: tx.from,
      to: tx.to,
      value: `${(Number(tx.value) / 1e18).toFixed(4)} ETH`,
      timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    }));

    // Log that the data was fetched from the API
    console.log("Data loaded from Etherscan API");

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Etherscan call failed; falling back to Neo4j:", error);

    // 2) Fallback: query Neo4j if Etherscan fails or returns no valid data
    const session = driver.session();
    try {
      const offsetNumber = parseInt(offset, 10);
      const pageNumber = parseInt(page, 10);
      const skip = (pageNumber - 1) * offsetNumber;

      // Adjust this Cypher query to match your Neo4j schema
      const query = `
        MATCH (tx:Transaction { address: $address })
        RETURN tx
        SKIP $skip
        LIMIT $limit
      `;
      const result = await session.run(query, {
        address,
        skip,
        limit: offsetNumber,
      });

      // Convert Neo4j records to plain objects
      const neo4jTransactions = result.records.map((r) => r.get("tx").properties);

      // Log that the data was fetched from the Neo4j database
      console.log("Data loaded from Neo4j database");

      return NextResponse.json(neo4jTransactions);
    } catch (neo4jError) {
      console.error("Neo4j fallback failed:", neo4jError);
      return NextResponse.json(
        { error: neo4jError instanceof Error ? neo4jError.message : "Neo4j error" },
        { status: 500 }
      );
    } finally {
      await session.close();
    }
  }
}
