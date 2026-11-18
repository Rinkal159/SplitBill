import React, { useContext, useEffect, useState } from "react";
import api from "../../api/axios";
import formatDate from "../../utils/formatDate";
import { AuthContext } from "../../context/AuthProvider";
import GroupCreate from "./GroupCreate";
import GroupDetails from "./GroupDetails";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";
import formatAmount from "../../utils/formatAmount";
import GroupSettlement from "../settlement/GroupSettlement";
import ExpenseSettlement from "../settlement/ExpenseSettlement";
import ExpenseSplitsSummary from "../expense/ExpenseSplitsSummary";
import LoadMore from "../common/LoadMore";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;

function GroupExpenses({
  receivedGroup,
  onInvitationSent,
  getGroups,
  loadSentSettlementReuqests,
  loadDashboardData,
}) {
  const { user } = useContext(AuthContext);
  const [expenses, setExpenses] = useState({});
  const [openExpense, setOpenExpense] = useState(null);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const navigate = useNavigate();

  const deleteExpense = async (event, id) => {
    event.stopPropagation();
    try {
      await api.delete(`/expenses/${id}`);
      setDeleteMessage("");
      await getGroupExpenses();
    } catch (error) {
      setDeleteMessage(
        getBackendError(error).error?.[0] ||
          "This expense has unsettled amounts. Settle all balances before deleting it.",
      );
    }
  };
  const [group, setGroup] = useState(receivedGroup);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
  const [showGroupSettlementModal, setShowGroupSettlementModal] =
    useState(false);
  const [showExpensewiseSettlementModal, setShowExpensewiseSettlementModal] =
    useState(null);

  const [
    expensewiseParticipantsYouBorrowedMoney,
    setExpensewiseParticipantsYouBorrowedMoney,
  ] = useState([]);

  // loading
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // error
  const [backErrors, setBackErrors] = useState({});

  const getGroupExpenses = async (nextPage = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const res = await api.get(`/expenses/groups/${group.id}`, {
        params: { page: nextPage, limit: PAGE_SIZE },
      });
      setExpenses((previous) => {
        const oldBalances = append ? (previous.friend_balances ?? {}) : {};
        const mergedBalances = { ...oldBalances };
        Object.entries(res.data.friend_balances ?? {}).forEach(
          ([id, value]) => {
            mergedBalances[id] =
              Number(mergedBalances[id] ?? 0) + Number(value);
          },
        );
        return {
          ...res.data,
          expenses: append
            ? [...(previous.expenses ?? []), ...res.data.expenses]
            : res.data.expenses,
          friend_balances: mergedBalances,
          total_balance: append
            ? Number(previous.total_balance ?? 0) +
              Number(res.data.total_balance)
            : res.data.total_balance,
        };
      });
      setPage(res.data.page);
      setHasMore(res.data.has_more);
      setLoading(false);
    } catch (error) {
      if (!append) setLoading(false);
      setBackErrors(getBackendError(error));
    } finally {
      setLoadingMore(false);
    }
  };

  const getAdmin = async () => {
    try {
      const res = await api.get(`/groups/${group.id}/admin`);
      setIsAdmin(res.data.is_admin);
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  useEffect(() => {
    setGroup(receivedGroup);
  }, [receivedGroup]);

  useEffect(() => {
    getGroupExpenses();
    getAdmin();
  }, [group]);

  if (loading) {
    return <Loading msg={receivedGroup.name} />;
  }

  return (
    <div className="p-6">
      {/* name, how much borrowed/lent and settle up */}
      <header className="flex justify-between items-center mb-6 border-2 border-white p-2 shadow-md bg-sky-50/60 rounded-full">
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 items-center hover:cursor-pointer group">
            <img
              className="!h-14 !w-14 object-cover group-hover:scale-105 border-2 border-white rounded-full"
              src={group.group_picture_path}
              alt={group.name}
            />
          </div>
          <div className="flex flex-col items-start group">
            <h1
              onClick={() => setShowGroupDetailsModal(true)}
              className="heading glittery-shadow pb-0 pt-0 group-hover:underline group-hover:cursor-pointer"
            >
              {group.name}
            </h1>
            {!hasMore && expenses.total_balance == 0
              ? expenses.expenses.length > 0 && (
                  <p>
                    You are <span className="accept-text">settled</span>
                  </p>
                )
              : !hasMore &&
                expenses.expenses.length > 0 && (
                  <p className="text-slate-600">
                    You{" "}
                    <span className="font-medium">
                      {expenses.total_balance < 0 ? "borrowed" : "lent"}
                    </span>{" "}
                    <span
                      className={`${expenses.total_balance < 0 ? "reject-text" : "accept-text"}`}
                    >
                      ₹{formatAmount(Math.abs(expenses.total_balance))}
                    </span>
                  </p>
                )}
          </div>
        </div>
        <div className="">
          {isAdmin && (
            <button
              onClick={() => setShowEditGroupModal(true)}
              className="invitation-btn edit-text edit-btn-shadow py-2 px-4"
            >
              Edit <i class="fa-solid fa-pen-to-square"></i>
            </button>
          )}

          {!hasMore && expenses.total_balance < 0 && (
            <button
              onClick={() => setShowGroupSettlementModal(true)}
              className="invitation-btn edit-text edit-btn-shadow py-2 px-4 mx-2"
            >
              Settle up
            </button>
          )}
        </div>
      </header>

      {/* expenses */}
      <div className="space-y-3">
        {Object.keys(backErrors).length !== 0 && (
          <Error errors={backErrors.error} type={backErrors.type} />
        )}
        {expenses && expenses.expenses.length > 0 ? (
          expenses?.expenses.map((expense) => {
            const balance = expense.your_balance;

            return (
              <div>
                <div
                  onClick={() => {
                    setOpenExpense(
                      openExpense === expense.expense.id
                        ? null
                        : expense.expense.id,
                    );
                  }}
                  key={expense.expense.id}
                  className={`${openExpense === expense.expense.id && "active-box"} hover:cursor-pointer flex items-center justify-between px-6 py-2 box`}
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

                    {/* left - expense title and expense */}
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
                        {balance > 0
                          ? " lent"
                          : balance < 0
                            ? " borrowed"
                            : " are"}
                      </p>

                      {/* amount */}
                      <p
                        className={`text-base text-lg font-semibold ${
                          balance > 0
                            ? "accept-text"
                            : balance < 0
                              ? "reject-text"
                              : "text-slate-500"
                        }`}
                      >
                        {Math.abs(balance) === 0 ? (
                          <span className="text-sm text-slate-600">
                            Settled
                          </span>
                        ) : (
                          "₹" + formatAmount(Math.abs(balance))
                        )}
                      </p>
                    </div>

                    {/* Person */}
                    <div className="w-32">
                      {balance !== 0 && (
                        <p className="text-xs text-slate-400 font-medium">
                          {balance > 0 ? "to" : balance < 0 ? "from" : ""}
                        </p>
                      )}

                      <p
                        className={`mt-0.5 truncate text-sm font-medium text-slate-700 ${expense.your_actual_settlements.length === 1 ? "font-medium text-slate-700" : "font-normal text-black"}`}
                      >
                        {expense.your_actual_settlements.length === 1
                          ? expense.your_actual_settlements[0].to_user.name
                          : expense.your_actual_settlements.length > 1
                            ? "Multiple people"
                            : ""}
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
                              className="small-img !rounded-full"
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

                      {expense.your_balance < 0 && (
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
                          onClick={(e) => deleteExpense(e, expense.expense.id)}
                          className="invitation-btn reject-text reject-btn-shadow"
                        >
                          Delete expense
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm italic text-slate-400 text-center">
            You don't have any shared expenses in {group.name}. <br /> share
            expenses and split easily.
          </div>
        )}
      </div>

      <LoadMore
        hasMore={hasMore}
        loading={loadingMore}
        label="group expenses"
        onClick={() => getGroupExpenses(page + 1, true)}
      />

      {deleteMessage && (
        <div className="outer-modal" onClick={() => setDeleteMessage("")}>
          <div
            className="inner-modal max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="cancel-icon top-2 right-2"
              onClick={() => setDeleteMessage("")}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <h2 className="heading glittery-shadow">
              Expense can’t be deleted
            </h2>
            <p className="py-4 text-center text-slate-600">{deleteMessage}</p>
            <button
              className="invitation-btn edit-text edit-btn-shadow"
              onClick={() => setDeleteMessage("")}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showGroupDetailsModal && (
        <GroupDetails
          onClose={() => setShowGroupDetailsModal(false)}
          group={group}
          isAdmin={isAdmin}
          onGroupChanged={async (action) => {
            setShowGroupDetailsModal(false);
            setLoading(true);
            await getGroups?.();
            if (action === "promote" || action === "remove") {
              try {
                const refreshed = await api.get(`/groups/${group.id}`);
                setGroup(refreshed.data.group);
                setIsAdmin(
                  refreshed.data.group.members.some(
                    (member) =>
                      member.user.id === user.id &&
                      member.role?.toUpperCase() === "ADMIN",
                  ),
                );
              } catch (error) {
                setBackErrors(getBackendError(error));
              }
              await getGroupExpenses();
            }
          }}
        />
      )}

      {showEditGroupModal && (
        <GroupCreate
          onClose={() => setShowEditGroupModal(false)}
          onInvitationSent={onInvitationSent}
          getGroups={getGroups}
          prevGroup={group}
          setReceivedGroup={setGroup}
        />
      )}

      {showGroupSettlementModal && (
        <GroupSettlement
          group={group}
          expenses={expenses}
          onClose={() => setShowGroupSettlementModal(false)}
          loadGroupExpenses={getGroupExpenses}
          setGroupExpenseLoading={setLoading}
          loadSentSettlementReuqests={loadSentSettlementReuqests}
          loadDashboardData={loadDashboardData}
        />
      )}

      {showExpensewiseSettlementModal && (
        <ExpenseSettlement
          expenseId={showExpensewiseSettlementModal.expense.id}
          expenseTitle={showExpensewiseSettlementModal.expense.title}
          onClose={() => setShowExpensewiseSettlementModal(null)}
          participants={expensewiseParticipantsYouBorrowedMoney}
          setExpenseLoading={setLoading}
          loadExpenses={getGroupExpenses}
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

export default GroupExpenses;
