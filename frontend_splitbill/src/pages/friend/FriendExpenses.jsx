import React, { useContext, useEffect, useState } from "react";
import api from "../../api/axios";
import formatDate from "../../utils/formatDate";
import { AuthContext } from "../../context/AuthProvider";
import Filter from "../group/Filter";
import Loading from "../loading/Loading";
import formatAmount from "../../utils/formatAmount";
import getBackendError from "../../utils/getBackendError";
import Error from "../error/Error";
import FriendSettlement from "../settlement/FriendSettlement";
import ExpenseSettlement from "../settlement/ExpenseSettlement";
import ExpenseSplitsSummary from "../expense/ExpenseSplitsSummary";
import LoadMore from "../common/LoadMore";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;

const settlementGroupRequests = new Map();

async function loadSettlementGroups(friendId, refresh = false) {
  if (refresh || !settlementGroupRequests.has(friendId)) {
    const request = api
      .get(`/expenses/groups/debt/${friendId}`)
      .then((response) => response.data)
      .catch((error) => {
        settlementGroupRequests.delete(friendId);
        throw error;
      });
    settlementGroupRequests.set(friendId, request);
  }
  return settlementGroupRequests.get(friendId);
}

function FriendExpenses({ friend, isGroupOnlySettlement = false, loadSentSettlementReuqests, loadDashboardData }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState({});
  const [settlementGroups, setSettlementGroups] = useState([]);
  const [settlementGroupsLoading, setSettlementGroupsLoading] = useState(true);
  const [openExpense, setOpenExpense] = useState(null);
  const [expenseSummary, setExpenseSummary] = useState(null);

  // loading
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expensePage, setExpensePage] = useState(1);
  const [expensesHaveMore, setExpensesHaveMore] = useState(false);

  // error
  const [backErrors, setBackErrors] = useState({});

  const filters = ["all", "group expenses", "individual expenses"];
  const [activeFilter, setActiveFilter] = useState("all");
  const [filteredExpenses, setFilteredExpenses] = useState([]);

  // settle up
  const [showFriendSettlementModal, setShowFriendSettlementModal] =
      useState(false);
  const [showExpensewiseSettlementModal, setShowExpensewiseSettlementModal] =
    useState(false);

  const [
    expensewiseParticipantsYouBorrowedMoney,
    setExpensewiseParticipantsYouBorrowedMoney,
  ] = useState([]);


  const getExpenses = async (page = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const response = await api.get(`expenses/friends/${friend.id}`, { params: { page, limit: PAGE_SIZE } });
      setExpenses((previous) => ({
        ...response.data,
        settlements: append ? [...(previous.settlements ?? []), ...response.data.settlements] : response.data.settlements,
      }));
      setExpensePage(response.data.page ?? page);
      setExpensesHaveMore(Boolean(response.data.has_more));
      setLoading(false);
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getSettlementGroups = async (friendId, refresh = false) => {
    setSettlementGroupsLoading(true);
    setSettlementGroups([]);
    try {
      const groups = await loadSettlementGroups(friendId, refresh);
      setSettlementGroups(groups);
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setSettlementGroupsLoading(false);
    }
  };

  // run getExpenses whenever user clicks on any friend, which means when friend.id changes, this function runs
  useEffect(() => {
    if (friend?.id) {
      getExpenses();
      getSettlementGroups(friend.id);
    }
  }, [friend?.id]);

  useEffect(() => {
    setFilteredExpenses(expenses?.settlements ?? []);
  }, [expenses]);

  const handleFilterChange = (filter) => {
    const settlements = expenses?.settlements ?? [];

    if (filter === "group expenses") {
      setFilteredExpenses(
        settlements.filter((item) => item.expense.group != null),
      );
    } else if (filter === "individual expenses") {
      setFilteredExpenses(
        settlements.filter((item) => item.expense.group == null),
      );
    } else {
      setFilteredExpenses(settlements);
    }
  };

  if (loading) {
    return <Loading msg={friend.name} />;
  }

  if (Object.keys(backErrors).length !== 0) {
    return <Error errors={backErrors?.error} type={backErrors?.type} />;
  }

  const balance =
    activeFilter === "group expenses"
      ? (expenses.group_balance ?? 0)
      : activeFilter === "individual expenses"
        ? (expenses.individual_balance ?? 0)
        : (expenses.total_balance ?? 0);

  return (
    <div className="p-6">
      {/* name, how much borrowed/lent and settle up */}
      <header className="flex justify-between items-center mb-6 border-2 border-white p-2 shadow-md bg-sky-50/60 rounded-full">
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 items-center hover:cursor-pointer group">
            <img
              className="!h-14 !w-14 object-cover group-hover:scale-105 border-2 border-white rounded-full"
              src={friend.profile_picture_path}
              alt={friend.name}
            />
          </div>
          <div className="flex flex-col items-start">
            <h1 className="heading glittery-shadow pb-0 pt-0  group-hover:underline">
              {friend.name}
            </h1>
            {expenses.settlements.length > 0 &&
              (Number(balance) === 0 ? (
                <p className="text-sm">
                  You are <span className="accept-text">settled</span>
                </p>
              ) : (
                <p className="text-slate-600 text-sm">
                  You{" "}
                  <span className="font-medium">
                    {balance < 0 ? "borrowed" : "lent"}
                  </span>{" "}
                  <span
                    className={`${balance < 0 ? "reject-text" : "accept-text"}`}
                  >
                    ₹{formatAmount(Math.abs(balance))}
                  </span>
                </p>
              ))}
          </div>
        </div>
        {balance < 0 && (
          <button
            onClick={() => setShowFriendSettlementModal(true)}
            className="invitation-btn edit-text edit-btn-shadow py-2 px-4 mx-2"
          >
            Settle up
          </button>
        )}
      </header>

      {/* all expenses */}
      <div className="space-y-3">
        {expenses && expenses.settlements.length > 0 ? (
          <>
            {/* filters */}
            <div className="pb-2">
              {filters.map((filter, i) => (
                <Filter
                  key={filter}
                  value={filter}
                  isActive={activeFilter === filter}
                  doApplyBorder={i !== filters.length - 1}
                  onClick={() => {
                    setActiveFilter(filter);
                    handleFilterChange(filter);
                  }}
                />
              ))}
            </div>
            {filteredExpenses.length === 0 && (
              <p className="text-center text-sm italic text-slate-400">
                No {activeFilter} found.
              </p>
            )}

            {/* expenses */}
            {filteredExpenses.map((expense) => {
              const balance_with_friend =
                expense.your_expensewise_balance_with_friend;

              return (
                <>
                  <div
                    onClick={() => {
                      setOpenExpense(
                        openExpense === expense.expense.id
                          ? null
                          : expense.expense.id,
                      );
                    }}
                    key={expense.expense.id}
                    className={`${openExpense === expense.expense.id ? "bg-gradient-to-br from-sky-50/80 via-white to-sky-50/80 shadow-md shadow-blue-100/80" : "shadow-sm shadow-slate-200"} flex items-center justify-between px-6 py-2 hover:border-blue-200 hover:bg-gradient-to-br from-sky-50/80 via-white to-sky-50/80 hover:shadow-md hover:shadow-blue-100/80 hover:cursor-pointer`}
                  >
                    {/* LEFT half - Expense name, and date */}
                    <div className="flex items-center gap-4">
                      {/* left first half */}
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center bg-blue-50/60 text-slate-600">
                        <span className="text-xs font-medium uppercase">
                          {new Date(
                            expense.expense.expense_date,
                          ).toLocaleDateString("en-US", { month: "short" })}
                        </span>

                        <span className="text-lg font-bold leading-5 text-slate-800">
                          {new Date(expense.expense.expense_date).getDate()}
                        </span>
                      </div>

                      {/* left - expense title and date */}
                      <div className="min-w-0">
                        <h2 className="text-slate-800 font-semibold text-sm">
                          {expense.expense.title}
                        </h2>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(expense.expense.expense_date)}
                        </p>
                      </div>
                    </div>

                    {/* RIGHT half - Balance information */}
                    <div className="flex gap-6">
                      <div className="text-right">
                        {/* lent or borrowed */}
                        <p className="text-xs font-medium text-slate-400">
                          You
                          {balance_with_friend > 0
                            ? " lent"
                            : balance_with_friend < 0
                              ? " borrowed"
                              : " are"}
                        </p>

                        {/* amount */}
                        <p
                          className={` text-lg font-semibold ${
                            balance_with_friend > 0
                              ? "accept-text"
                              : balance_with_friend < 0
                                ? "reject-text"
                                : "text-slate-500"
                          }`}
                        >
                          {Math.abs(balance_with_friend) === 0 ? (
                            <span className="text-sm accept-text">Settled</span>
                          ) : (
                            "₹" + formatAmount(Math.abs(balance_with_friend))
                          )}
                        </p>
                      </div>

                      {/* Person */}
                      <div className="w-32">
                        <p className="text-xs text-slate-400 font-medium">
                          {balance_with_friend > 0
                            ? "to"
                            : balance_with_friend < 0
                              ? "from"
                              : "with"}
                        </p>
                        <p
                          className={`truncate ${balance_with_friend === 0 ? "mt-1" : "mt-0.5"} text-sm font-medium text-slate-700`}
                        >
                          {friend.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expense all details */}
                  <div
                    className={`overflow-hidden bg-sky-50/20 transition-all duration-500 ease-out ${
                      openExpense === expense.expense.id
                        ? "max-h-[1000px] opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-6 py-0">
                      <h1 className="pt-4 text-md font-semibold text-slate-500">
                        Expense details :
                      </h1>

                      <h1 className="pt-1 text-lg font-normal text-slate-800">
                        {expense.expense.title}
                      </h1>

                      {expense.expense.group && (
                        <p className="pb-1 text-sm font-medium text-slate-500">
                          Group:{" "}
                          <span className="text-slate-600">
                            {expense.expense.group.name}
                          </span>
                        </p>
                      )}

                      <p className="text-2xl font-semibold text-slate-800">
                        ₹{formatAmount(expense.expense.total_amount)}
                      </p>

                      {expense.expense.description && (
                        <p className="pt-2 text-sm text-slate-600">
                          {expense.expense.description}
                        </p>
                      )}

                      {expense.expense.note && (
                        <p className="pt-2 text-sm text-slate-500">
                          {expense.expense.note}
                        </p>
                      )}

                      <p className="py-2 pb-4 text-sm text-slate-500">
                        Created by{" "}
                        <span className="font-semibold text-slate-700">
                          {expense.expense.created_by === user.id
                            ? "You"
                            : expense.expense.creator.name}
                        </span>{" "}
                        on{" "}
                        <span className="font-semibold text-slate-700">
                          {formatDate(expense.expense.expense_date)}
                        </span>
                      </p>

                      <hr className="border-slate-200" />

                      {/* Expense Splits */}
                      <div className="flex justify-between items-center mt-2">
                    <h1 className="text-md font-semibold text-slate-600">
                      Expense summary :
                    </h1>
                    <div className="group text-slate-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpenseSummary(expense);
                        }}
                        className="font-semibold  pr-1 group-hover:underline"
                      >
                        Expense splits
                      </button>
                      <i class="fa-solid fa-arrow-right-long relative top-0.5 trans group-hover:translate-x-0.5"></i>
                    </div>
                  </div>

                      {expense.your_actual_settlements.length === 0 &&
                        expense.others_actual_settlements.length === 0 && (
                          <p className="pt-2 text-sm italic text-slate-400">
                            There are no other settlements for this expense.
                          </p>
                        )}

                      {/* Your settlements */}
                      {expense.your_actual_settlements.length > 0 && (
                        <ul className="space-y-1 pt-1">
                          {expense.your_actual_settlements.map((your) => (
                            <div
                              className="flex gap-2 items-center"
                              key={your.to_user.id}
                            >
                              <img
                                className="small-img object-cover border-2 border-white"
                                src={user.profile_picture_path}
                                alt={user.name}
                              />

                              <div className="flex justify-between w-full items-center pr-6">
                                <li className="text-sm text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    You
                                  </span>{" "}
                                  {your.amount > 0 ? "lent" : "borrowed"}{" "}
                                  <span
                                    className={
                                      your.amount > 0
                                        ? "font-semibold accept-text"
                                        : "font-semibold reject-text"
                                    }
                                  >
                                    ₹{formatAmount(Math.abs(your.amount))}
                                  </span>{" "}
                                  {your.amount > 0 ? "to" : "from"}{" "}
                                  <span className="font-semibold text-slate-800">
                                    {your.to_user.name}
                                  </span>
                                </li>
                              </div>
                            </div>
                          ))}
                        </ul>
                      )}

                      {/* Other settlements */}
                      {expense.others_actual_settlements.length > 0 && (
                        <ul className="space-y-2 pt-2">
                          {expense.others_actual_settlements.map((other) => (
                            <li
                              className="flex items-center gap-2 text-sm text-slate-600"
                              key={other.from_user.id + other.to_user.id}
                            >
                              <img
                                className="small-img !rounded-full "
                                src={other.from_user.profile_picture_path}
                                alt={other.from_user.name}
                              />

                              <span>
                                <span className="font-semibold text-slate-800">
                                  {other.from_user.name}
                                </span>{" "}
                                {other.amount > 0 ? "lent" : "borrowed"}{" "}
                                <span
                                  className={
                                    other.amount > 0
                                      ? "font-semibold accept-text"
                                      : "font-semibold reject-text"
                                  }
                                >
                                  ₹{formatAmount(Math.abs(other.amount))}
                                </span>{" "}
                                {other.amount > 0 ? "to" : "from"}{" "}
                                <span className="font-semibold text-slate-800">
                                  {other.to_user.name}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 py-4">
                        
                        {user.id == expense.expense.created_by && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/expenses/${expense.expense.id}/edit`);
                            }}
                            className="invitation-btn edit-text edit-btn-shadow"
                          >
                            Edit expense
                          </button>
                        )}

                        {balance_with_friend < 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpensewiseParticipantsYouBorrowedMoney(
                                expense.your_settlements,
                              );
                              setShowExpensewiseSettlementModal({
                                expense: expense.expense,
                              });
                            }}
                            className="invitation-btn accept-text accept-btn-shadow"
                          >
                            Settle up
                          </button>
                        )}

                        {user.id == expense.expense.created_by && (
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="invitation-btn reject-text reject-btn-shadow"
                          >
                            Delete expense
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })}
          </>
        ) : (
          <div className="text-sm italic text-slate-400 text-center">
            You don't have any shared expenses with {friend.name}. <br /> share
            expenses and split easily.
          </div>
        )}
      </div>

      <LoadMore hasMore={expensesHaveMore} loading={loadingMore} label="expenses" onClick={() => getExpenses(expensePage + 1, true)} />

      {showFriendSettlementModal && (
        <FriendSettlement
          onClose={() => setShowFriendSettlementModal(false)}
          toUser={friend}
          isGroupOnlySettlement={isGroupOnlySettlement}
          settlementValue={formatAmount(Math.abs(balance))}
          overallValue={expenses.total_balance}
          individualValue={expenses.individual_balance}
          loadFriendExpenses={getExpenses}
          setFriendExpensesLoading={setLoading}
          loadSentSettlementReuqests={loadSentSettlementReuqests}
          activeFilter={activeFilter}
          settlementGroups={settlementGroups}
          settlementGroupsLoading={settlementGroupsLoading}
          loadDashboardData={loadDashboardData}
        />
      )}

      {showExpensewiseSettlementModal && (
        <ExpenseSettlement
          expenseId={showExpensewiseSettlementModal.expense.id}
          expenseTitle={showExpensewiseSettlementModal.expense.title}
          participants={expensewiseParticipantsYouBorrowedMoney}
          onClose={() => setShowExpensewiseSettlementModal(null)}
          setExpenseLoading={setLoading}
          loadExpenses={getExpenses}
          loadSentSettlementReuqests={loadSentSettlementReuqests}
          loadDashboardData={loadDashboardData}
        />
      )}

      {expenseSummary && (
        <ExpenseSplitsSummary
          expense={expenseSummary}
          onClose={() => setExpenseSummary(null)}
        />
      )}
    </div>
  );
}

export default FriendExpenses;
