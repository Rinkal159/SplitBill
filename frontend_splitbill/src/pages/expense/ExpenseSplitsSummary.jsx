import formatAmount from "../../utils/formatAmount";

const methodLabels = {
  equal: "Equally",
  amount: "By amount",
  percentage: "By percentage",
};

function ExpenseSplitsSummary({ expense, onClose }) {
  if (!expense) return null;

  const splitMethod = expense.expense.split_method;
  const splits = [...(expense.expense_splits ?? [])].sort((a, b) =>
    a.user.name.localeCompare(b.user.name),
  );
  const history = expense.settlement_history ?? [];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-splits-summary-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-sky-100 bg-sky-50 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
              Expense summary
            </p>
            <h2
              id="expense-splits-summary-title"
              className="mt-1 truncate text-xl font-bold glittery-shadow"
            >
              {expense.expense.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Total{" "}
              <span className="font-semibold">
                ₹{formatAmount(expense.expense.total_amount)}
              </span>{" "}
              · Split{" "}
              {(
                <span className="font-medium">{methodLabels[splitMethod]}</span>
              ) ?? "method not recorded"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense summary"
            className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">
                  Who paid and owes what
                </h3>
                <p className="text-xs text-slate-500">
                  Share is what they owed; paid is what they actually paid.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {splits.length} {splits.length === 1 ? "person" : "people"}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[600px] table-fixed text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="w-[40%] border-b border-r border-slate-200 px-4 py-3.5 text-left">
                      Name
                    </th>
                    <th className="w-1/5 border-b border-r border-slate-200 px-3 py-3.5 text-center">
                      Share
                    </th>
                    <th className="w-1/5 border-b border-r border-slate-200 px-3 py-3.5 text-center">
                      Paid
                    </th>
                    <th className="w-1/5 border-b border-slate-200 px-3 py-3.5 text-center">
                      Difference
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split) => {
                    const difference =
                      Number(split.paid_amount) - Number(split.share_amount);
                    const amountClass =
                      difference < 0
                        ? "reject-text"
                        : difference > 0
                          ? "accept-text"
                          : "text-slate-500";
                    const splitDescription =
                      splitMethod === "amount"
                        ? `Amount split · ₹${formatAmount(split.split_value ?? split.share_amount)}`
                        : splitMethod === "percentage"
                          ? `Percentage split · ${Number(split.split_value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`
                          : splitMethod === "equal"
                            ? "Equal split"
                            : "Split method not recorded";

                    return (
                      <tr
                        key={split.user.id}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="border-r border-slate-200 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <img
                              src={split.user.profile_picture_path}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">
                                {split.user.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {difference > 0 ? (
                                  <span className="accept-text">Paid extra ₹{Math.abs(difference)}</span>
                                ) : difference < 0 ? (
                                  <span className="reject-text">Owes ₹{Math.abs(difference)}</span>
                                ) : (
                                  <span className="slate-text">Settled</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 px-2 py-2 text-center">
                          <p className="font-semibold text-slate-700">
                            ₹{formatAmount(split.share_amount)}
                          </p>
                        </td>
                        <td className="border-r border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">
                          ₹{formatAmount(split.paid_amount)}
                        </td>
                        <td
                          className={`border-r border-slate-200 px-2 py-2 text-center font-semibold ${amountClass}`}
                        >
                          {difference < 0 ? "−" : difference > 0 ? "+" : ""}₹
                          {formatAmount(Math.abs(difference))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h3 className="font-semibold text-slate-800">
                Your settlement history
              </h3>
              <p className="text-xs text-slate-500">
                Settlements involving you for this expense.
              </p>
            </div>
            {history.length ? (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {history.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800">
                          {item.direction === "PAID"
                            ? "You paid"
                            : "You received"}{" "}
                          <span className="text-sky-700">
                            {item.counterparty.name}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(
                            `${item.settlement_date}T00:00:00`,
                          ).toLocaleDateString()}{" "}
                          · {item.payment_method}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">
                          ₹{formatAmount(item.amount)}
                        </p>
                        <span className="text-xs capitalize text-slate-500">
                          {String(item.status).toLowerCase()}
                        </span>
                      </div>
                    </div>
                    {Number(item.total_amount) !== Number(item.amount) && (
                      <p className="mt-2 text-xs text-slate-500">
                        From ₹{formatAmount(item.total_amount)} total settlement
                      </p>
                    )}
                    {item.note && (
                      <p className="mt-2 break-words text-sm text-slate-600">
                        {item.note}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                You've recorded no settlements for this expense.
              </p>
            )}
          </section>
        </div>

        <footer className="border-t border-slate-100 bg-white px-5 py-3 text-right sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="invitation-btn edit-text edit-btn-shadow"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ExpenseSplitsSummary;
