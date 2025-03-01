import { NextResponse } from "next/server";
import neo4j from "neo4j-driver";

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

  try {
    const session = driver.session();
    try {
      // Parse and validate offset
      let offsetNumber = parseInt(offset, 10);
      if (isNaN(offsetNumber) || offsetNumber <= 0) {
        offsetNumber = 50;
      }
      offsetNumber = Math.floor(offsetNumber); // Ensure integer

      // Parse page and calculate skip
      const pageNumber = parseInt(page, 10);
      const skip = (pageNumber - 1) * offsetNumber;

      // Cypher query
      const query = `
        MATCH (wallet)-[tx:Transfer]-(other)
        WHERE wallet.addressId = $address
        RETURN wallet, tx, other
        SKIP $skip
        LIMIT $limit
      `;

      // Pass parameters as Neo4j integers
      const result = await session.run(query, {
        address,
        skip: neo4j.int(skip),       // Convert to Neo4j integer
        limit: neo4j.int(offsetNumber) // Convert to Neo4j integer
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
  } catch (error) {
    console.error("Neo4j call failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
