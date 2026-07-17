import {
  FolderOpenIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

interface CaseRecord {
  case_id: string;
  severity: string;
  status: string;
  sla_breach_at?: string;
  assigned_to?: number;
  created_at: string;
}

interface SummaryCardsProps {
  cases: CaseRecord[];
}

export function SummaryCards({ cases }: SummaryCardsProps) {
  const stats = {
    pending: cases.filter(c => c.status === 'new').length,
    active: cases.filter(c => c.status === 'in_progress').length,
    slaRisk: cases.filter(c => {
      if (!c.sla_breach_at) return false;
      const hoursUntilBreach = (new Date(c.sla_breach_at).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilBreach < 2 && hoursUntilBreach > 0;
    }).length,
    assigned: cases.filter(c => c.assigned_to).length,
  };

  const cards = [
    {
      title: 'Pending',
      value: stats.pending,
      subtitle: 'Awaiting assignment',
      icon: FolderOpenIcon,
      iconColor: 'text-blue-400',
      valueBg: 'bg-blue-500/10',
    },
    {
      title: 'Active',
      value: stats.active,
      subtitle: 'Being handled',
      icon: UserGroupIcon,
      iconColor: 'text-emerald-400',
      valueBg: 'bg-emerald-500/10',
    },
    {
      title: 'SLA Risk',
      value: stats.slaRisk,
      subtitle: '<2 hours left',
      icon: ExclamationTriangleIcon,
      iconColor: 'text-red-400',
      valueBg: 'bg-red-500/10',
    },
    {
      title: 'Assigned',
      value: stats.assigned,
      subtitle: 'Auto-assigned by CMA',
      icon: ClockIcon,
      iconColor: 'text-purple-400',
      valueBg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
              {card.title}
            </p>
            <div className="p-2 bg-white/5 rounded-lg">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{card.value}</p>
          <p className="text-[11px] text-white/40 mt-1">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
