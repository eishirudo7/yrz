'use client'

import { Suspense } from 'react'
import { useDashboard } from '@/app/hooks/useDashboard'
import { OrdersSummary } from './Summary'
import { OrdersDetailTable } from './TableOrder'

export function Dashboard() {
  const { orders, summary, isLoading } = useDashboard()

  return (
    <Suspense fallback={<div>Memuat data...</div>}>
      <div className="m-2">
        <OrdersSummary summary={summary} />
        <OrdersDetailTable orders={orders} isLoading={isLoading} />
      </div>
    </Suspense>
  )
}
