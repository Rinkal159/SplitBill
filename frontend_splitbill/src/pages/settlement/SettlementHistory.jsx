import { useEffect, useState } from "react";
import api from "../../api/axios";
import getBackendError from "../../utils/getBackendError";
import formatAmount from "../../utils/formatAmount";
import Loading from "../loading/Loading";
import Error from "../error/Error";
import LoadMore from "../common/LoadMore";

const PAGE_SIZE = 10;

export default function SettlementHistory() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState({});

  const load = async (nextPage = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const response = await api.get("/history/settlements", {
        params: { page: nextPage, limit: PAGE_SIZE },
      });
      setRows((previous) =>
        append ? [...previous, ...response.data.items] : response.data.items,
      );
      setPage(response.data.page);
      setHasMore(response.data.has_more);
      setError({});
    } catch (reason) {
      setError(getBackendError(reason));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading msg="Settlement history" />;

  return (
    <section className="mx-auto w-full max-w-3xl">
      <h1 className="heading glittery-shadow">Settlement history</h1>
      {Object.keys(error).length > 0 && (
        <Error errors={error.error} type={error.type} />
      )}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm italic text-slate-500">
          No settlement history yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 ">
          {rows.map((row, index) => (
            <li
              key={`${row.settlement_date}-${row.user.id}-${index}`}
              className="flex items-center gap-3 p-4 px-6 box group"
            >
              <img
                className="invite-img"
                src={row.user.profile_picture_path}
                alt={row.user.name}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-700">
                  {row.action === "PAID" ? "Paid" : "Received from"}{" "}
                  <span className="group-hover:glittery-shadow">{row.user.name}</span>
                </p>
                <p className="truncate text-sm text-slate-500">
                  {row.type}
                  {row.expense
                    ? ` · ${row.expense.title}`
                    : " settlement"} · {row.settlement_date}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-700 group-hover:font-bold">
                ₹{formatAmount(row.amount_settled)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <LoadMore
        hasMore={hasMore}
        loading={loadingMore}
        label="settlements"
        onClick={() => load(page + 1, true)}
      />
    </section>
  );
}
