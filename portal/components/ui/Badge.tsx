interface BadgeProps {
  status: string
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  awaiting_approval: 'bg-purple-100 text-purple-800',
  approved: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  quoted: 'Quoted',
  in_progress: 'In Progress',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Rejected',
}

export default function Badge({ status }: BadgeProps) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-700'
  const label = statusLabel[status] ?? status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}
