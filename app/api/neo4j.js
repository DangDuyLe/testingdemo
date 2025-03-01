import { getSession } from "@/lib/neo4j";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (n) RETURN n LIMIT 10
    `);
    
    const nodes = result.records.map(record => record.get("n").properties);

    res.status(200).json({ nodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
}
