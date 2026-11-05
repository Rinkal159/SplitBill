import { useState, useEffect, useContext } from "react";
import api from "../../api/axios";
import formatDate from "../../utils/formatDate.js";
import { AuthContext } from "../../context/AuthProvider.jsx";
import Loading from "../loading/Loading.jsx";
import getBackendError from "../../utils/getBackendError.js";

export default function AllExpenses() {
  const { user } = useContext(AuthContext);
  const [expenses, setExpenses] = useState({});
  const [openExpense, setOpenExpense] = useState(null);

  // loading
  const [loading, setLoading] = useState(true);

  // error
  const [backErrors, setBackErrors] = useState({});

  const getExpenses = async () => {
    try {
      const response = await api.get("/expenses");
      setExpenses(response.data); // object
      setLoading(false);
    } catch (error) {
      setLoading(true);
      setBackErrors(getBackendError(error));
    }
  };

  useEffect(() => {
    getExpenses();
  }, []);

  if (loading) {
    return <Loading msg={"Expenses"} />;
  }

  return (
    <div className="space-y-5">
      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}

      <h1 className="heading glittery-shadow">All expenses</h1>

      <div className="space-y-3">
        {expenses?.expenses.map((expense) => {
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
                        <span className="text-sm text-slate-600">Settled</span>
                      ) : (
                        "₹" + Math.abs(balance)
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
                      className={`mt-0.5 truncate text-sm font-medium text-slate-700 ${expense.your_settlements.length === 1 ? "font-medium text-slate-700" : "font-normal text-black"}`}
                    >
                      {expense.your_settlements.length === 1
                        ? expense.your_settlements[0].to_user.name
                        : expense.your_settlements.length > 1
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
                    ₹{expense.expense.total_amount}
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
                  <h1 className="pt-4 text-md font-semibold text-slate-600">
                    Expense splits :
                  </h1>

                  {expense.your_settlements.length === 0 &&
                    expense.other_settlements.length === 0 && (
                      <p className="pt-2 text-sm italic text-slate-400">
                        There are no other settlements for this expense.
                      </p>
                    )}

                  {/* Your settlements */}
                  {expense.your_settlements.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {expense.your_settlements.map((your) => (
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
                                ₹{Math.abs(your.amount)}
                              </span>{" "}
                              {your.amount > 0 ? "to" : "from"}{" "}
                              <span className="font-semibold text-slate-800">
                                {your.to_user.name}
                              </span>
                            </li>
                            {your.amount < 0 &&
                              expenses.friend_balances[your.to_user.id] < 0 && (
                                <button className="invitation-btn accept-text accpet-btn-shadow">
                                  Settle up individually
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                    </ul>
                  )}

                  {/* Other settlements */}
                  {expense.other_settlements.length > 0 && (
                    <ul className="space-y-2 pt-2">
                      {expense.other_settlements.map((other) => (
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
                              ₹{Math.abs(other.amount)}
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
                  <div className="flex gap-2 py-4">
                    {user.id == expense.expense.created_by && (
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="invitation-btn edit-text edit-btn-shadow"
                      >
                        Edit expense
                      </button>
                    )}

                    {expense.your_balance < 0 &&
                      expense.your_settlements.every(
                        (your) => expenses.friend_balances[your.to_user.id] < 0,
                      ) && (
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="invitation-btn accept-text accpet-btn-shadow"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
