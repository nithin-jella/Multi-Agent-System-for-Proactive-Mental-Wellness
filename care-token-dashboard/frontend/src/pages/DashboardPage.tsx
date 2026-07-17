import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Users, Award } from 'lucide-react'
import { revenueApi, stakingApi } from '../lib/api'

export default function DashboardPage() {
  const { data: revenueData } = useQuery({
    queryKey: ['revenue-current'],
    queryFn: async () => {
      const { data } = await revenueApi.getCurrent()
      return data.data
    },
  })

  const { data: stakingData } = useQuery({
    queryKey: ['staking-overview'],
    queryFn: async () => {
      const { data } = await stakingApi.getOverview()
      return data.data
    },
  })

  const stats = [
    {
      title: 'Total Revenue (Current Month)',
      value: `$${revenueData?.total_revenue || '0'}`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Net Profit (Current Month)',
      value: `$${revenueData?.net_profit || '0'}`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Total Stakers',
      value: stakingData?.total_stakers || '0',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'TVL (Total Value Locked)',
      value: `${Number(stakingData?.total_value_locked || 0).toLocaleString()} CARE`,
      icon: Award,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <Icon className={stat.color} size={24} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Revenue Breakdown */}
      {revenueData && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Revenue Breakdown (Current Month)</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Wellness Fees</span>
              <span className="font-semibold">${revenueData.breakdown.wellnessFees}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Subscriptions</span>
              <span className="font-semibold">${revenueData.breakdown.subscriptions}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">NFT Sales</span>
              <span className="font-semibold">${revenueData.breakdown.nftSales}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Partner Fees</span>
              <span className="font-semibold">${revenueData.breakdown.partnerFees}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Treasury Returns</span>
              <span className="font-semibold">${revenueData.breakdown.treasuryReturns}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
