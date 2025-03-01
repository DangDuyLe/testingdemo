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

  // Ensure that page and offset are integers and remove any decimals
  const pageNumber = parseInt(page, 10);
  const offsetNumber = parseInt(offset, 10);

  // Check if parsing resulted in valid integers
  if (isNaN(pageNumber) || isNaN(offsetNumber)) {
    return NextResponse.json({ error: "Invalid page or offset value" }, { status: 400 });
  }

  // Ensure that both pageNumber and offsetNumber are integers (no decimals)
  const limit = Math.max(0, Math.floor(offsetNumber)); // Ensure it's a non-negative integer, 0 will prevent errors
  const skip = Math.max(0, Math.floor((pageNumber - 1) * limit)); // Ensure skip is also a non-negative integer

  // Log that we are fetching data from the Neo4j database
  console.log("Fetching data from Neo4j database for address:", address);
  console.log("Using limit:", limit, "skip:", skip);

  const session = driver.session();
  try {
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
      limit,
    });

    // Convert Neo4j records to plain objects
    const neo4jTransactions = result.records.map((r) => r.get("tx").properties);

    // Log that data was successfully loaded from the database
    console.log("Data loaded from Neo4j database", neo4jTransactions);

    return NextResponse.json(neo4jTransactions);
  } catch (neo4jError) {
    console.error("Neo4j query failed:", neo4jError);
    return NextResponse.json(
      { error: neo4jError instanceof Error ? neo4jError.message : "Neo4j error" },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
