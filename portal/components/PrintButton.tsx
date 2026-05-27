'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-primary hover:bg-blue-900 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
    >
      Download PDF
    </button>
  )
}
