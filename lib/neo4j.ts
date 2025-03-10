import neo4j, { Driver, Session } from 'neo4j-driver'

let driver: Driver | null = null

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI
    const username = process.env.NEO4J_USERNAME
    const password = process.env.NEO4J_PASSWORD

    if (!uri || !username || !password) {
      throw new Error('Neo4j environment variables are not properly configured')
    }

    try {
      driver = neo4j.driver(
        uri,
        neo4j.auth.basic(username, password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
          logging: {
            level: 'info',
            logger: (level, message) => {
              console.log(`[Neo4j ${level}] ${message}`)
            }
          }
        }
      )
    } catch (error) {
      console.error('Failed to create Neo4j driver:', error)
      throw error
    }
  }

  return driver
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    try {
      await driver.close()
      driver = null
    } catch (error) {
      console.error('Error closing Neo4j driver:', error)
      throw error
    }
  }
}

// Helper function to run queries with session management
export async function runQuery(cypher: string, params = {}) {
  let session: Session | null = null
  try {
    session = getDriver().session()
    const result = await session.run(cypher, params)
    return result.records
  } catch (error) {
    console.error('Error executing Neo4j query:', error)
    throw error
  } finally {
    if (session) {
      try {
        await session.close()
      } catch (error) {
        console.error('Error closing Neo4j session:', error)
      }
    }
  }
}

// Initialize driver with connectivity check
export async function initializeDriver(): Promise<void> {
  try {
    const driver = getDriver()
    await driver.verifyConnectivity()
    console.log('Neo4j connection established successfully')
  } catch (error) {
    console.error('Failed to establish Neo4j connection:', error)
    throw error
  }
}

// Query execution with retry logic
export async function runQueryWithRetry(
  cypher: string,
  params = {},
  maxRetries = 3
): Promise<any[]> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    let session: Session | null = null
    try {
      session = getDriver().session()
      const result = await session.run(cypher, params)
      return result.records
    } catch (error) {
      console.error(`Query attempt ${i + 1} failed:`, error)
      lastError = error as Error
      
      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    } finally {
      if (session) {
        try {
          await session.close()
        } catch (error) {
          console.error('Error closing Neo4j session:', error)
        }
      }
    }
  }
  
  throw new Error(`Query failed after ${maxRetries} attempts: ${lastError?.message}`)
}