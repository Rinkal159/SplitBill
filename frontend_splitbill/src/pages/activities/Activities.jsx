import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import Filter from "../group/Filter";
import Loading from "../loading/Loading";
import Error from "../error/Error"
import getBackError from "../../utils/getBackendError"

const GROUP_TYPES = new Set(["GROUP"]);
const EXPENSE_TYPES = new Set([
  "EXPENSE",
  "GROUP_EXPENSE",
  "EXPENSEWISE_SETTLEMENT",
]);

function ActivityTypeIcon({ activity }) {
  if (GROUP_TYPES.has(activity.type)) {
    return (
      <img
        src={activity.group?.group_picture_path || "/default_group_picture.png"}
        alt={activity.group?.name || "Group"}
        className="
        w-14 h-14 rounded-full object-cover
        border-2 border-white shadow-md"
      />
    );
  }

  let icon = "fa-user-group";
  let color = "from-violet-100 to-indigo-100 text-indigo-600";
  if (EXPENSE_TYPES.has(activity.type)) {
    icon = "fa-receipt";
    color = "from-amber-100 to-orange-100 text-orange-600";
  } else if (activity.type.includes("SETTLEMENT")) {
    icon = "fa-money-bill-transfer";
    color = "from-emerald-100 to-teal-100 text-emerald-600";
  } else if (activity.type === "FRIEND") {
    icon = "fa-user-plus";
    color = "from-sky-100 to-cyan-100 text-sky-600";
  }

  return (
    <div
      className={`absolute left-0 top-0 flex items-center justify-center
    w-14 h-14 rounded-full border-2 border-white shadow-md ${color}`}
    >
      <i className={`fa-solid ${icon} text-2xl`} aria-hidden="true" />
    </div>
  );
}

const PAGE_SIZE = 10;

function Activities({setBackErrors}) {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // loading
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const filters = ["all", "activity type", "performed by you"];
  const [activeFilter, setActiveFilter] = useState("all");
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [filterClicked, setFilterClicked] = useState(false);

  const getActivities = async ({ nextPage = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = {
        page: nextPage,
        limit: PAGE_SIZE,
      };

      const res = await api.get("/activities", { params });
      const data = res.data;

      setActivities((current) =>
        append
          ? [...current, ...(data.activities || [])]
          : data.activities || [],
      );
      setPage(data.page || nextPage);
      setHasMore(Boolean(data.has_more));
    } catch (error) {
      setBackErrors(getBackError(error))
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    getActivities();
  }, []);

  useEffect(() => {
    setFilteredActivities(activities);
  }, [activities]);

  const getFilteredActivities = (value) => {
    switch (value) {
      case "expense":
        return activities.filter((activity) => activity.type === "EXPENSE");
      case "settlement":
        return activities.filter((activity) => activity.type === "SETTLEMENT");
      case "friend":
        return activities.filter((activity) => activity.type === "FRIEND");
      case "group":
        return activities.filter((activity) => activity.type === "GROUP");
      case "user":
        return activities.filter((activity) => activity.type === "USER");

      default:
        return activities;
    }
  };

  const filterSubvalueClick = (value, filter) => {
    setActiveFilter(filter);
    setFilterClicked(true);
    const newActivities = getFilteredActivities(value);
    setFilteredActivities(newActivities);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !filterClicked) {
      getActivities({ nextPage: page + 1, append: true });
    }
  };

  if (loading) {
    return <Loading msg={"Activities"} />
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <h1 className="heading glittery-shadow mb-6">Activities</h1>

      <div className="px-4 pb-4">
        {filters.map((filter, i) => (
          <Filter
            key={i}
            value={filter}
            subvalues={
              filter === "activity type" && [
                "expense",
                "settlement",
                "friend",
                "group",
                "user",
              ]
            }
            isActive={activeFilter === filter}
            doApplyBorder={i !== filters.length - 1}
            onClick={() => {
              setActiveFilter(filter);
              setFilterClicked(true);

              if (filter === "all") {
                setFilteredActivities(activities);
                setFilterClicked(false);
              } else if (filter === "performed by you") {
                const newActivities = activities.filter(
                  (activity) => activity.performed_by_me,
                );
                setFilteredActivities(newActivities);
              }
            }}
            onSubvalueClick={filterSubvalueClick}
          />
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <div className="italic-text text-center py-6 text-md">
          No activities yet.
        </div>
      )}

      <ul className="space-y-3">
        {filteredActivities.map((activity, i) => {
          const date = new Date(activity.performed_at);
          const performer = activity.performed_by;

          return (
            <li
              key={`${activity.type}-${activity.performed_at}-${i}`}
              className="box flex items-center gap-4 px-4 py-2"
            >
              {/* left first half */}
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center bg-blue-50/60 text-slate-600">
                <span className="text-xs font-medium uppercase">
                  {new Date(activity.performed_at).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </span>

                <span className="text-lg font-bold leading-5 text-slate-800">
                  {new Date(activity.performed_at).getDate()}
                </span>
              </div>

              <div className="relative flex-shrink-0 w-[70px] h-[65px]">
                <ActivityTypeIcon activity={activity} />
                <img
                  src={performer?.profile_picture_path || "/default.png"}
                  alt={
                    performer?.name
                      ? `${performer.name}'s profile`
                      : "Activity performer"
                  }
                  className="absolute right-0 bottom-0
        w-8 h-8 rounded-full object-cover
        border-2 border-white shadow-md
        transition-transform duration-200 ease-in-out
        "
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-slate-800">
                  {activity.summary || "Activity recorded"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && !filterClicked && (
        <div className="py-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="invitation-btn edit-text edit-btn-shadow"
          >
            {loadingMore ? "Loading..." : "Load more activities"}
          </button>
        </div>
      )}
    </section>
  );
}

export default Activities;
