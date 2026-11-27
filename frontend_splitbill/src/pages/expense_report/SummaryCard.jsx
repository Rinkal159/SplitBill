import formatAmount from "../../utils/formatAmount";

export default function SummaryCard({ title, icon: Icon, amount, color }) {
  return (
    <div className={`rounded-xl ${color} px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Icon size={15} aria-hidden="true" />
        <span>{title}</span>
      </div>
      <p className="mt-1 truncate text-base font-semibold text-slate-700">
        ₹{formatAmount(amount)}
      </p>
    </div>
  );
}