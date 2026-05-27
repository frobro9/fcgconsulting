interface RetainerBalanceProps {
  balance: number
}

export default function RetainerBalance({ balance }: RetainerBalanceProps) {
  const isLow = balance < 100
  const isWarning = balance >= 100 && balance < 200

  const colorClass = isLow
    ? 'text-red-600'
    : isWarning
    ? 'text-yellow-600'
    : 'text-green-600'

  const bgClass = isLow
    ? 'bg-red-50 border-red-200'
    : isWarning
    ? 'bg-yellow-50 border-yellow-200'
    : 'bg-green-50 border-green-200'

  return (
    <div className={`rounded-xl border p-6 ${bgClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">Retainer Balance</p>
          <p className={`text-3xl font-bold mt-1 ${colorClass}`}>
            ${balance.toFixed(2)}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isLow
              ? 'bg-red-100'
              : isWarning
              ? 'bg-yellow-100'
              : 'bg-green-100'
          }`}
        >
          <span className="text-xl">
            {isLow ? '⚠️' : isWarning ? '💛' : '✅'}
          </span>
        </div>
      </div>

      {isLow && (
        <div className="mt-4 bg-red-100 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 font-medium">
            Low balance warning: Your retainer balance is below $100. Please top up to continue
            receiving services without interruption.
          </p>
        </div>
      )}

      {isWarning && (
        <div className="mt-4 bg-yellow-100 border border-yellow-200 rounded-lg px-4 py-3">
          <p className="text-sm text-yellow-700 font-medium">
            Your retainer balance is getting low. Consider topping up soon.
          </p>
        </div>
      )}
    </div>
  )
}
