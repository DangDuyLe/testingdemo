'use client';

import Link from 'next/link';
import { Metadata } from "next"
import { Suspense } from "react"
import NetworkStats from '@/components/transactions/NetworkStats';
import ParticlesBackground from '@/components/ParticlesBackground';
import RevenueGraph from '@/components/transactions/RevenueGraph';
import { Skeleton } from "@/components/ui/skeleton"
import WalletCharts from '@/components/transactions/WalletCharts';
import TransactionTable from '@/components/transactions/TransactionTable';

export default function TransactionExplorer() {
  return (
    <div className="relative min-h-screen text-white font-exo2">
      <ParticlesBackground />
      
      <div className="relative z-10">
        {/* Main Content */}
        <div className="container mx-auto p-4">
          <div className="mb-6">
            <RevenueGraph />
          </div>
          <WalletCharts />
          <NetworkStats />
          <div className="mt-6">
            <TransactionTable />
          </div>
        </div>
      </div>
    </div>
  );
}
