import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import formatAmount from "../../utils/formatAmount";
import { Minus, Plus, ReceiptText, CircleDollarSign } from "lucide-react";
import SummaryCard from "./SummaryCard";

const periods = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

const categoryColors = {
  food: "#ffdb81",
  shopping: "#3b82f6",
  travel: "#24dfc9",
  other: "#88d2f9",
};
const fallbackColors = ["#eab308", "#ec4899", "#06b6d4", "#64748b"];

function getCategoryColor(category, index) {
  const normalized = String(category ?? "")
    .trim()
    .toLowerCase();
  if (normalized.includes("food") || normalized.includes("dining"))
    return categoryColors.food;
  if (normalized.includes("shop")) return categoryColors.shopping;
  if (normalized.includes("travel")) return categoryColors.travel;
  if (normalized === "other" || normalized === "others")
    return categoryColors.other;
  return fallbackColors[index % fallbackColors.length];
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(period, selectedDate = new Date()) {
  const now = new Date(selectedDate);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  if (period === "weekly") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  }

  return {
    start_date: toLocalDateString(start),
    end_date: toLocalDateString(end),
  };
}

function getPeriodDate(period, offset, today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === "daily") date.setDate(date.getDate() - offset);
  if (period === "weekly") {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) - offset * 7);
  }
  if (period === "monthly") {
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
  }
  return date;
}

function getPeriodOptions(period) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, offset) => {
    const date = getPeriodDate(period, offset, today);
    let label;
    if (period === "daily") {
      label =
        offset === 0
          ? "Today"
          : offset === 1
            ? "Yesterday"
            : date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
    } else if (period === "weekly") {
      label =
        offset === 0
          ? "This week"
          : `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    } else {
      label =
        offset === 0
          ? "This month"
          : date.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            });
    }
    return { date, label };
  });
}

function getSelectedPeriodLabel(period, date) {
  if (period === "daily")
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  if (period === "weekly") {
    const weekStart = new Date(
      `${getDateRange(period, date).start_date}T00:00:00`,
    );
    return `Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function ExpenseReports({ friend, group, refreshKey }) {
  const [activePeriod, setActivePeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [openMenu, setOpenMenu] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateRange = useMemo(
    () => getDateRange(activePeriod, selectedDate),
    [activePeriod, selectedDate],
  );
  const scopeLabel = group?.name || friend?.name || "Your expenses";

  useEffect(() => {
    let isCurrent = true;

    async function loadReport() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/expenses/total", {
          params: {
            ...dateRange,
            ...(group?.id ? { group_id: group.id } : {}),
            ...(friend?.id ? { friend_id: friend.id } : {}),
          },
        });
        if (isCurrent) setReport(response.data);
      } catch {
        if (isCurrent) setError("Couldn’t load your expense report.");
      } finally {
        if (isCurrent) setLoading(false);
      }
    }

    loadReport();
    return () => {
      isCurrent = false;
    };
  }, [dateRange, friend?.id, group?.id, refreshKey]);

  const categories = report?.categories ?? [];
  const chart = useMemo(() => {
    let offset = 0;
    const stops = categories.map((item, index) => {
      const amount = Math.max(0, Number(item.percentage) || 0);
      const start = offset;
      offset += amount;
      return `${getCategoryColor(item.category, index)} ${start}% ${offset}%`;
    });
    return stops.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0";
  }, [categories]);

  return (
    <section
      className="mt-4 rounded-2xl  p-4 shadow-xl shadow-blue-100 border border-white"
      aria-labelledby="expense-report-title"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="expense-report-title"
            className="heading glittery-shadow font-medium py-0.5"
          >
            Expense report
          </h2>
          <p className="truncate text-[11px] text-slate-500" title={scopeLabel}>
            {scopeLabel}
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
          {getSelectedPeriodLabel(activePeriod, selectedDate)}
        </span>
      </div>

      <div
        className="mb-5 grid grid-cols-3 rounded-xl bg-slate-50 p-1"
        role="tablist"
        aria-label="Report period"
        onMouseLeave={() => setOpenMenu(null)}
      >
        {periods.map((period) => (
          <div
            key={period.value}
            className="relative"
            onMouseEnter={() => setOpenMenu(period.value)}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activePeriod === period.value}
              aria-haspopup="menu"
              aria-expanded={openMenu === period.value}
              onFocus={() => setOpenMenu(period.value)}
              onClick={() => {
                setActivePeriod(period.value);
                setOpenMenu(openMenu === period.value ? null : period.value);
              }}
              className={`w-full rounded-lg px-2 py-2 text-xs font-medium transition ${
                activePeriod === period.value
                  ? "bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-700"
              }`}
            >
              {period.label}
            </button>
            {openMenu === period.value && (
              <div
                role="menu"
                aria-label={`Choose a ${period.label.toLowerCase()} period`}
                className="absolute left-0 top-full z-30 max-h-72 w-52 overflow-y-auto rounded-xl border border-blue-100 bg-white p-2 shadow-xl shadow-blue-100/70"
                onMouseEnter={() => setOpenMenu(period.value)}
              >
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Recent{" "}
                  {period.value === "daily"
                    ? "days"
                    : period.value === "weekly"
                      ? "weeks"
                      : "months"}
                </p>
                {getPeriodOptions(period.value).map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActivePeriod(period.value);
                      setSelectedDate(option.date);
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-slate-600 hover:bg-sky-50 hover:text-sky-700"
                  >
                    <span>{option.label}</span>
                    {toLocalDateString(option.date) ===
                      toLocalDateString(selectedDate) &&
                      activePeriod === period.value && (
                        <span className="text-sky-600" aria-label="Selected">
                          ✓
                        </span>
                      )}
                  </button>
                ))}
                <label className="mt-1 block border-t border-slate-100 px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Choose from calendar
                  <input
                    type={period.value === "monthly" ? "month" : "date"}
                    value={
                      period.value === "monthly"
                        ? toLocalDateString(selectedDate).slice(0, 7)
                        : toLocalDateString(selectedDate)
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      const chosenDate = new Date(
                        `${value.length === 7 ? `${value}-01` : value}T00:00:00`,
                      );
                      setActivePeriod(period.value);
                      setSelectedDate(chosenDate);
                      setOpenMenu(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-600 outline-none focus:border-sky-400"
                    aria-label={`Choose ${period.label.toLowerCase()} from calendar`}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Loading expense report">
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : error ? (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard
              title="Expenses"
              icon={ReceiptText}
              amount={report?.total_expenses ?? 0}
              color="bg-sky-50"
            />
            <SummaryCard
              title="Net Expense"
              icon={CircleDollarSign}
              amount={report?.total_balance ?? 0}
              color="bg-sky-50"
            />
            <SummaryCard
              title="Borrowed"
              icon={Minus}
              amount={report?.total_borrowings ?? 0}
              color="bg-rose-50/80"
            />
            <SummaryCard
              title="Lent"
              icon={Plus}
              amount={report?.total_lendings ?? 0}
              color="bg-green-50"
            />
          </div>

          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Spending by category
            </h3>
            {categories.length ? (
              <>
                <div
                  className="mx-auto mb-4 grid h-36 w-36 place-items-center rounded-full"
                  style={{ background: chart }}
                  role="img"
                  aria-label="Donut chart of spending by category"
                >
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center shadow-inner">
                    <div>
                      <p className="text-[10px] text-slate-400">Your share</p>
                      <p className="max-w-[68px] truncate text-xs font-bold text-slate-700">
                        ₹{formatAmount(report?.your_shares ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
                <ul className="space-y-2">
                  {categories.map((item, index) => (
                    <li
                      key={item.category}
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: getCategoryColor(
                            item.category,
                            index,
                          ),
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className="min-w-0 flex-1 truncate text-slate-600"
                        title={item.category}
                      >
                        {item.category}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-700">
                        {Number(item.percentage).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-7 text-center text-xs text-slate-500">
                No expenses in this period yet.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default ExpenseReports;
