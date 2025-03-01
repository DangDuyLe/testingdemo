"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Dynamically import ForceGraph2D
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Define the structure of a transaction
interface Transaction {
  id: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

// Define the structure of a graph node
interface GraphNode {
  id: string | number;
  label: string;
  color: string;
  type: "in" | "out" | "both";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  [others: string]: any;
}

// Define the structure of graph data
interface GraphData {
  nodes: GraphNode[];
  links: { source: string; target: string; value: number }[];
}

// Define the structure of the API response
interface ApiResponse {
  success: boolean;
  address: string;
  page: number;
  limit: number;
  total: number;
  transactions: any[]; // Flexible to handle diverse transaction data structures
  error?: string;
}

// Utility to generate a random color
const getRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16)}`;

// Utility to shorten an Ethereum address
const shortenAddress = (address: string): string =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Invalid";

// Mock function to get a name for an address
const getNameForAddress = (address: string): string | null => {
  const mockNames: Record<string, string> = {
    "0x1234567890123456789012345678901234567890": "Alice",
    "0x0987654321098765432109876543210987654321": "Bob",
  };
  return mockNames[address] || null;
};

export default function TransactionGraph() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch transaction data
  useEffect(() => {
    if (!address) return;

    setLoading(true);
    setError(null);

    fetch(`/api/transactions?address=${address}&limit=50`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((response: ApiResponse) => {
        // Validate API response and ensure transactions is an array
        if (!response?.success || !Array.isArray(response.transactions)) {
          throw new Error(response?.error || "Invalid transaction data");
        }

        const transactions = response.transactions || [];
        const nodes = new Map<string, GraphNode>();
        const links: GraphData["links"] = [];

        // Process transactions to create nodes and links
        transactions.forEach((tx) => {
          // Extracting from and to wallet addresses from query result
          const fromAddress = tx?.From?.addressId; // From Wallet Address
          const toAddress = tx?.To?.addressId; // To Wallet Address
          const value = tx?.Transfer?.value; // Transaction Value

          // Ensure addresses are valid
          if (fromAddress && toAddress) {
            // Add From address node
            if (!nodes.has(fromAddress)) {
              const name = getNameForAddress(fromAddress);
              nodes.set(fromAddress, {
                id: fromAddress,
                label: name || shortenAddress(fromAddress),
                color: getRandomColor(),
                type: "out", // From address is "out"
              });
            }

            // Add To address node
            if (!nodes.has(toAddress)) {
              const name = getNameForAddress(toAddress);
              nodes.set(toAddress, {
                id: toAddress,
                label: name || shortenAddress(toAddress),
                color: getRandomColor(),
                type: "in", // To address is "in"
              });
            }

            // Link the addresses with the transaction value
            links.push({
              source: fromAddress,
              target: toAddress,
              value: Number.parseFloat(value || "0"),
            });
          }
        });

        setGraphData({ nodes: Array.from(nodes.values()), links });
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [address]);

  // Handle node clicks to open address in Etherscan
  const handleNodeClick = useCallback(
    (node: { id?: string | number; [others: string]: any }) => {
      const nodeId = node.id;
      if (typeof nodeId === "string") {
        window.open(`https://etherscan.io/address/${nodeId}`, "_blank");
      }
    },
    []
  );

  // Render loading state
  if (loading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent>
          <p className="text-center text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  // Render empty state
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent>
          <p className="text-center">No transactions found for this address</p>
        </CardContent>
      </Card>
    );
  }

  // Render the graph
  return (
    <Card className="h-[540px] bg-gray-900">
      <CardHeader>
        <CardTitle>Transaction Graph</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="label"
          nodeColor="color"
          nodeCanvasObject={(node, ctx, globalScale) => {
            const { label, type, x = 0, y = 0 } = node as GraphNode;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.beginPath();
            ctx.arc(x, y, type === "both" ? 6 : 4, 0, 2 * Math.PI, false);
            ctx.fillStyle =
              type === "in"
                ? "rgba(0, 255, 0, 0.5)"
                : type === "out"
                ? "rgba(255, 0, 0, 0.5)"
                : "rgba(255, 255, 0, 0.5)";
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.fillText(label, x, y);
          }}
          nodeRelSize={6}
          linkWidth={1}
          linkColor="rgba(255, 255, 255, 0.2)"
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.005}
          d3VelocityDecay={0.3}
          d3AlphaDecay={0.01}
          onNodeClick={handleNodeClick}
          width={580}
          height={440}
        />
      </CardContent>
    </Card>
  );
}
