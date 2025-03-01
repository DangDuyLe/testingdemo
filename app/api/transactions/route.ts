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

  // Log the received `offset` and `page` values for debugging
  console.log("Received page:", page);
  console.log("Received offset:", offset);

  try {
    // 1) Directly fallback to Neo4j query (no Etherscan API call)
    const session = driver.session();
    try {
      // Parse the `offset` as an integer and validate it
      let offsetNumber = parseInt(offset, 10);

      // If the parsed offset is invalid or <= 0, fallback to 50
      if (isNaN(offsetNumber) || offsetNumber <= 0) {
        offsetNumber = 50; 
        console.log("Offset is invalid. Falling back to default value of 50.");
      }

      const pageNumber = parseInt(page, 10);
      if (isNaN(pageNumber) || pageNumber <= 0) {
        console.log("Page is invalid. Falling back to default value of 1.");
        pageNumber = 1; // Fallback to page 1 if invalid
      }

      const skip = (pageNumber - 1) * offsetNumber;

      // Log final values of skip and limit for debugging
      console.log("Final skip:", skip);
      console.log("Final limit:", offsetNumber);

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
  } catch (error) {
    console.error("Neo4j call failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
