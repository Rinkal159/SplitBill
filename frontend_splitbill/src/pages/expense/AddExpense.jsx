import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileText,
  Gift,
  Plane,
  ShoppingBag,
  Utensils,
  ReceiptText,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { AuthContext } from "../../context/AuthProvider";
import SelectMenu from "./SelectMenu";
import PayBreakdown from "./PayBreakdown";
import Error from "../error/Error";
import getBackendError from "../../utils/getBackendError";
import LabelAndInput from "../auth/LabelAndInput";

const categories = [
  {
    value: "Food",
    label: "Food",
    Icon: Utensils,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  {
    value: "Shopping",
    label: "Shopping",
    Icon: ShoppingBag,
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
  {
    value: "Travel",
    label: "Travel",
    Icon: Plane,
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    value: "Other",
    label: "Other",
    Icon: ReceiptText,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

function AddExpense() {
  const { expenseId } = useParams();
  const isEditing = Boolean(expenseId);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [addLoading, setAddLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(isEditing);
  const [expense, setExpense] = useState({
    title: "",
    note: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [category, setCategory] = useState("Other");
  const [attachment, setAttachment] = useState(null);
  const [frontErrors, setFrontErrors] = useState([]);
  const [backErrors, setBackErrors] = useState({});
  const [friendOptions, setFriendOptions] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([
    { value: user.id, label: "You", isFixed: true },
  ]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [memberOptions, setMemberOptions] = useState([]);
  const [paidBy, setPaidBy] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [splitModal, setSplitModal] = useState(false);
  const [splitMethod, setSplitMethod] = useState(null);
  const [splitAmounts, setSplitAmounts] = useState([]);
  const [splitPercentages, setSplitPercentages] = useState([]);
  const expenseAmount = Number(expense.amount);
  const totalPayment = payments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const totalSplitAmount = splitAmounts.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const totalSplitPercentage = splitPercentages.reduce(
    (sum, item) => sum + Number(item.percentage || 0),
    0,
  );
  const paymentOptions = [
    { value: user.id, label: "You" },
    ...selectedParticipants.filter((p) => p.value !== user.id),
    { value: "multiple", label: "Multiple people" },
  ];
  const participantOptions = [
    ...memberOptions.filter((option) => option.value !== user.id),
    { value: "__select_all__", label: "Select all", isSelectAll: true },
  ];
  const splitOptions = [
    { value: "equal", label: "Equal" },
    { value: "percentage", label: "Percentage" },
    { value: "amount", label: "Custom" },
  ];
  const currentCategory =
    categories.find((item) => item.value === category) || categories[3];
  const validAmount = Number.isFinite(expenseAmount) && expenseAmount > 0;
  const toCents = (amount) => Math.round((Number(amount) || 0) * 100);
  const paymentError =
    Math.abs(totalPayment - expenseAmount) >= 0.005
      ? "Total paid amount and Expense amount must be equal."
      : "";
  const splitError =
    splitMethod?.value === "amount" &&
    toCents(totalSplitAmount) !== toCents(expenseAmount)
      ? `Custom split amounts must equal the expense amount (₹${(expenseAmount || 0).toFixed(2)}).`
      : splitMethod?.value === "percentage" &&
          Math.abs(totalSplitPercentage - 100) >= 0.01
        ? "Percentages must add up to 100."
        : "";
  const splitReady =
    splitMethod?.value === "equal" ||
    (splitMethod?.value === "amount" && !splitError) ||
    (splitMethod?.value === "percentage" && !splitError);
  const peopleReady =
    selectedParticipants.length > 1 && Boolean(paidBy) && !paymentError;
  const canSave =
    expense.title.trim() &&
    validAmount &&
    expense.expense_date &&
    peopleReady &&
    splitReady &&
    !expenseLoading &&
    !addLoading;
  const selectedNames = selectedParticipants.map((p) => p.label).join(", ");

  useEffect(() => {
    let ignore = false;
    const loadOptions = async () => {
      try {
        const [friends, groups] = await Promise.all([
          api.get("/friends/name"),
          api.get("/groups/name"),
        ]);
        if (!ignore) {
          setFriendOptions(
            friends.data.map((item) => ({ value: item.id, label: item.name })),
          );
          setGroupOptions(
            groups.data.map((item) => ({
              value: item.group.id,
              label: item.group.name,
            })),
          );
        }
      } catch (error) {
        if (!ignore) setBackErrors(getBackendError(error));
      }
    };
    loadOptions();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGroup) {
      setMemberOptions(friendOptions);
      return;
    }
    let ignore = false;
    api
      .get(`/groups/${selectedGroup.value}`)
      .then((res) => {
        if (ignore) return;
        if (res.data.total_members <= 1) {
          setMemberOptions(friendOptions);
          setSelectedGroup(null);
          setFrontErrors(["Select a group with more than one member."]);
          return;
        }
        setMemberOptions(
          res.data.group.members.map((member) => ({
            value: member.user.id,
            label: member.user.name,
          })),
        );
      })
      .catch((error) => {
        if (!ignore) {
          setMemberOptions(friendOptions);
          setSelectedGroup(null);
          setBackErrors(getBackendError(error));
        }
      });
    return () => {
      ignore = true;
    };
  }, [selectedGroup, friendOptions]);

  useEffect(() => {
    if (!expenseId) return;
    let ignore = false;
    api
      .get(`/expenses/edit/${expenseId}`)
      .then(({ data }) => {
        if (ignore) return;
        const details = data;
        setExpense({
          title: details.title || "",
          note: details.note || "",
          amount: Number(details.total_amount),
          expense_date: details.expense_date,
        });
        setCategory(details.category || "Other");
        setSelectedGroup(
          details.group
            ? { value: details.group.id, label: details.group.name }
            : null,
        );
        setSelectedParticipants(
          data.expense_splits.map(({ user: person }) => ({
            value: person.id,
            label: person.id === user.id ? "You" : person.name,
            isFixed: person.id === user.id,
          })),
        );
        setPayments(
          data.expense_splits.map((split) => ({
            id: split.user.id,
            name: split.user.id === user.id ? "You" : split.user.name,
            amount: Number(split.paid_amount),
          })),
        );
        const payers = data.expense_splits.filter(
          (split) => Number(split.paid_amount) > 0,
        );
        setPaidBy(
          payers.length === 1
            ? {
                value: payers[0].user.id,
                label:
                  payers[0].user.id === user.id ? "You" : payers[0].user.name,
              }
            : { value: "multiple", label: "Multiple people" },
        );
        const method = details.split_method || "equal";
        setSplitMethod(splitOptions.find((item) => item.value === method));
        if (method === "amount")
          setSplitAmounts(
            data.expense_splits.map((split) => ({
              id: split.user.id,
              name: split.user.name,
              amount: Number(split.split_value || 0),
            })),
          );
        if (method === "percentage")
          setSplitPercentages(
            data.expense_splits.map((split) => ({
              id: split.user.id,
              name: split.user.name,
              percentage: Number(split.split_value || 0),
            })),
          );
      })
      .catch((error) => {
        if (!ignore)
          setBackErrors(
            error.response
              ? getBackendError(error)
              : { error: [error.message], type: 404 },
          );
      })
      .finally(() => {
        if (!ignore) setExpenseLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [expenseId, user.id]);

  useEffect(() => {
    setSplitAmounts((old) =>
      selectedParticipants.map((p) => ({
        id: p.value,
        name: p.label,
        amount: old.find((x) => x.id === p.value)?.amount ?? 0,
      })),
    );
    setSplitPercentages((old) =>
      selectedParticipants.map((p) => ({
        id: p.value,
        name: p.label,
        percentage: old.find((x) => x.id === p.value)?.percentage ?? 0,
      })),
    );
    if (
      paidBy &&
      paidBy.value !== "multiple" &&
      !selectedParticipants.some((p) => p.value === paidBy.value)
    ) {
      setPaidBy(null);
      setPayments([]);
      return;
    }
    setPayments((old) =>
      selectedParticipants.map((p) => ({
        id: p.value,
        name: p.label,
        amount:
          paidBy?.value === "multiple"
            ? (old.find((x) => x.id === p.value)?.amount ?? 0)
            : paidBy?.value === p.value
              ? expenseAmount
              : 0,
      })),
    );
  }, [selectedParticipants, paidBy, expenseAmount]);

  const handlePaidBy = (option) => {
    setPaidBy(option);
    if (option?.value === "multiple") {
      setPayments((old) =>
        selectedParticipants.map((p) => ({
          id: p.value,
          name: p.label,
          amount: old.find((x) => x.id === p.value)?.amount ?? 0,
        })),
      );
      setPaymentModal(true);
    } else {
      setPaymentModal(false);
      setPayments(
        option
          ? selectedParticipants.map((p) => ({
              id: p.value,
              name: p.label,
              amount: p.value === option.value ? expenseAmount : 0,
            }))
          : [],
      );
    }
  };

  const handleParticipantsChange = (options = []) => {
    const hasSelectAll = options.some((option) => option.isSelectAll);
    const nextParticipants = hasSelectAll
      ? [
          { value: user.id, label: "You", isFixed: true },
          ...memberOptions.filter((option) => option.value !== user.id),
        ]
      : [
          { value: user.id, label: "You", isFixed: true },
          ...options.filter(
            (option) => !option.isSelectAll && option.value !== user.id,
          ),
        ];

    setSelectedParticipants(nextParticipants);
    if (nextParticipants.length <= 1) {
      setPaidBy(null);
      setPayments([]);
      setPaymentModal(false);
      setSplitModal(false);
    }
  };
  const handleBreakdownChange = (event, id, setter, field) =>
    setter((old) =>
      old.map((item) =>
        item.id === id
          ? { ...item, [field]: Number(event.target.value) || 0 }
          : item,
      ),
    );
  const changeAmount = (value) => {
    setExpense((old) => ({ ...old, amount: value }));
    setSplitAmounts((old) => old.map((split) => ({ ...split, amount: 0 })));
    setSplitPercentages((old) =>
      old.map((split) => ({ ...split, percentage: 0 })),
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setFrontErrors([]);
    if (!expense.title.trim())
      return setFrontErrors(["Enter an expense title."]);
    if (!validAmount)
      return setFrontErrors(["Enter an amount greater than zero."]);
    if (expense.note.trim() && expense.note.trim().length < 10)
      return setFrontErrors(["Note must be at least 10 characters."]);
    if (selectedParticipants.length < 2)
      return setFrontErrors(["Select at least one other participant."]);
    if (!paidBy || paymentError)
      return setFrontErrors([
        paymentError || "Choose who paid for this expense.",
      ]);
    if (!splitMethod || splitError)
      return setFrontErrors([splitError || "Choose a split method."]);
    const splitDetails =
      splitMethod.value === "amount"
        ? splitAmounts.map((x) => ({ user_id: x.id, amount: x.amount }))
        : splitMethod.value === "percentage"
          ? splitPercentages.map((x) => ({
              user_id: x.id,
              percentage: x.percentage,
            }))
          : null;
    const body = {
      group_id: selectedGroup?.value ?? null,
      title: expense.title.trim(),
      note: expense.note.trim() || null,
      total_amount: expenseAmount,
      expense_date: expense.expense_date,
      participants: selectedParticipants.map((p) => p.value),
      payments: payments.map((p) => ({ user_id: p.id, amount: p.amount })),
      split_method: splitMethod.value,
      expense_splits: splitDetails,
      category,
    };
    try {
      setAddLoading(true);
      const result = isEditing
        ? await api.put(`/expenses/${expenseId}`, body)
        : await api.post("/expenses", body);
      const savedId = expenseId || result.data.id;
      if (attachment && savedId) {
        const form = new FormData();
        form.append("attachment", attachment);
        await api.post(`/expenses/${savedId}/attachment`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      navigate("/dashboard");
    } catch (error) {
      setBackErrors(getBackendError(error));
      setAddLoading(false);
    }
  };

  const closeModal = () => navigate("/dashboard");

  return (
    <div className="outer-modal">
      <div className="inner-modal add-expense-modal-shell max-w-2xl ">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
          className="add-expense-modal-content relative flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-2xl shadow-sky-200"
        >
          <header className="relative border-b border-slate-100 sm:px-7">
            <h1
              id="add-expense-title"
              className="heading glittery-shadow text-center"
            >
              {isEditing ? "Edit expense" : "Add an expense"}
            </h1>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close expense summary"
              className="cancel-icon"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </header>
          {expenseLoading ? (
            <div className="p-16 text-center text-sm text-slate-500">
              Loading expense details…
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="add-expense-modal-form min-h-0 flex-1 overflow-y-auto"
            >
              {/* error */}
              <div className="px-5 py-5 sm:px-7 sm:py-6">
                {(frontErrors.length > 0 ||
                  Object.keys(backErrors).length > 0) && (
                  <div className="mb-4">
                    {frontErrors.length > 0 && <Error errors={frontErrors} />}
                    {Object.keys(backErrors).length > 0 && (
                      <Error errors={backErrors.error} type={backErrors.type} />
                    )}
                  </div>
                )}

                {/** EXPENSE DETAILS */}
                <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6">
                  <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                    Expense details
                  </legend>

                  <div>
                    <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
                      <div className="rounded-2xl p-3 flex flex-col gap-4">
                        {/* Expense icon */}
                        <div className="flex flex-row items-center gap-3 border border-slate-200 rounded-2xl sm:flex-col sm:justify-center sm:p-4">
                          <div
                            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${currentCategory.bg} ${currentCategory.color}`}
                          >
                            <currentCategory.Icon size={30} strokeWidth={1.8} />
                          </div>
                          <div className="w-full">
                            <label
                              className="form-lbl"
                              htmlFor="expense-category"
                            >
                              Expense category
                            </label>
                            <select
                              id="expense-category"
                              className="form-input mt-1 !py-2"
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                            >
                              {categories.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Expense receipt */}
                        {/* <div className="rounded-2xl shadow-md sm:p-4">
                        <label
                          className="form-lbl"
                          htmlFor="expense-attachment"
                        >
                          Receipt image
                        </label>
                        <input
                          id="expense-attachment"
                          className="form-input mt-1.5 !px-2 !py-1.5 text-xs"
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setAttachment(e.target.files?.[0] || null)
                          }
                        />
                        {attachment && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {attachment.name}
                          </p>
                        )}
                      </div> */}
                      </div>

                      {/* expense title and amount */}
                      <div className="min-w-0 space-y-4">
                        {/* Expense title */}
                        <LabelAndInput
                          type={"text"}
                          field={"title"}
                          labelValue={"Title"}
                          required
                          person={expense}
                          placeholder={"Exter title"}
                          handleEvent={(e) => {
                            setExpense((prevExpense) => ({
                              ...prevExpense,
                              title: e.target.value,
                            }));
                          }}
                          autoFocus
                          showError={false}
                        />

                        {/* Expense amount */}
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                          <label htmlFor="expense-amount" className="form-lbl">
                            Amount <span className="text-red-400">*</span>
                          </label>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-2xl font-medium text-slate-400">
                              ₹
                            </span>
                            <input
                              id="expense-amount"
                              className="w-full min-w-0 border-0 bg-transparent text-3xl font-semibold tracking-tight text-slate-600 outline-none placeholder:text-slate-300 focus:ring-0"
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={expense.amount}
                              onChange={(e) => changeAmount(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* expense note and date */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Expense note */}
                      <div className="flex-1 space-y-2">
                        <label className="form-lbl" htmlFor="expense-note">
                          Note
                        </label>
                        <div className="relative mt-1.5">
                          <FileText
                            size={16}
                            className="pointer-events-none absolute left-3 top-3 text-slate-400"
                          />
                          <input
                            id="expense-note"
                            className="form-input pl-9 "
                            maxLength={1000}
                            value={expense.note}
                            onChange={(e) =>
                              setExpense({ ...expense, note: e.target.value })
                            }
                            placeholder="Add a note (optional)"
                          />
                        </div>
                      </div>

                      {/* Expense date */}
                      <div className="flex-1 space-y-2">
                        <label htmlFor="date" className="form-lbl">
                          Date
                          <span className="text-red-400 text-sm">*</span>
                        </label>

                        <input
                          className="form-input w-full"
                          type="date"
                          name="date"
                          id="date"
                          value={expense.expense_date}
                          onChange={(e) =>
                            setExpense((prevExpense) => ({
                              ...prevExpense,
                              expense_date: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* PARTICIPANTS */}
                <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6 mt-2">
                  <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                    Participants & Splits
                  </legend>
                  <div className="">
                    {/* GROUP */}
                    <div>
                      <SelectMenu
                        options={groupOptions}
                        value={selectedGroup}
                        onChange={(group) => {
                          if (
                            (group?.value ?? null) !==
                            (selectedGroup?.value ?? null)
                          ) {
                            setSelectedParticipants([
                              { value: user.id, label: "You", isFixed: true },
                            ]);
                            setPaidBy(null);
                            setPayments([]);
                            setSplitMethod(null);
                            setSplitAmounts([]);
                            setSplitPercentages([]);
                          }
                          setSelectedGroup(group);
                        }}
                        field="group"
                        label="Group"
                        placeholder="Personal expense if optional"
                        isMultiSelect={false}
                        closeMenuOnSelect
                        required={false}
                        menuPortalTarget={document.body}
                      />
                    </div>

                    <div className="grid w-full grid-cols-2 items-start gap-4 pt-3">
                      {/* Participants */}
                      <div className="min-w-0 w-full">
                        <SelectMenu
                          options={participantOptions}
                          value={selectedParticipants}
                          onChange={handleParticipantsChange}
                          field="participants"
                          label="Participants"
                          additionalInfo="Select friends or group members"
                          placeholder="Select participants"
                          isMultiSelect
                          closeMenuOnSelect={false}
                          required
                          menuPortalTarget={document.body}
                        />
                      </div>

                      {/* Paid by */}
                      <div className="min-w-0 w-full">
                        <SelectMenu
                          options={paymentOptions}
                          value={paidBy}
                          onChange={handlePaidBy}
                          field="payment"
                          label="Paid by"
                          additionalInfo="Choose who paid this expense."
                          placeholder={
                            selectedParticipants.length > 1
                              ? "Select who paid"
                              : "Choose participants first"
                          }
                          isMultiSelect={false}
                          closeMenuOnSelect
                          menuPortalTarget={document.body}
                          isDisabled={selectedParticipants.length <= 1}
                        />
                        {paidBy?.value === "multiple" && (
                          <button
                            type="button"
                            onClick={() => setPaymentModal(true)}
                            className="mt-2 flex w-full items-center justify-between rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 text-left text-xs font-medium text-sky-700 hover:bg-sky-50"
                          >
                            <span>
                              Payment breakdown · ₹{totalPayment.toFixed(2)} of
                              ₹{(expenseAmount || 0).toFixed(2)}
                            </span>
                            <ChevronDown size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expense Splits */}
                    {selectedParticipants.length > 1 && (
                      <div className="mt-3">
                        <p className="form-lbl pb-2">
                          How should it be split?{" "}
                          <span className="text-red-400 text-sm">*</span>
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {splitOptions.map((option) => (
                            <button
                              type="button"
                              key={option.value}
                              onClick={() => {
                                setSplitMethod(option);
                                setSplitModal(option.value !== "equal");
                              }}
                              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${splitMethod?.value === option.value ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm" : "border-slate-200 text-slate-600 hover:border-sky-200 hover:bg-sky-50/40"}`}
                            >
                              {splitMethod?.value === option.value && (
                                <Check size={14} className="mr-1 inline" />
                              )}
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedParticipants.length > 1 &&
                      splitMethod &&
                      splitMethod.value !== "equal" && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setSplitModal(true)}
                            className="flex w-full items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            <span>
                              {splitMethod.value === "amount"
                                ? `Custom split · ₹${totalSplitAmount.toFixed(2)} of ₹${(expenseAmount || 0).toFixed(2)}`
                                : `Percentage split · ${totalSplitPercentage.toFixed(2)}% of 100%`}
                            </span>
                            <ChevronDown size={15} />
                          </button>
                          {splitError && (
                            <p className="mt-1.5 text-xs font-medium text-red-500">
                              {splitError}
                            </p>
                          )}
                        </div>
                      )}
                  </div>
                </fieldset>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="max-w-[65%] truncate text-xs text-slate-500">
                  {selectedNames || "Select people to share this expense"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={addLoading}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200/70 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addLoading
                      ? "Saving…"
                      : isEditing
                        ? "Save changes"
                        : "Save expense"}
                  </button>
                </div>
              </footer>
            </form>
          )}
        </section>
        {paymentModal && (
          <div
            className="outer-modal z-[80]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPaymentModal(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-breakdown-title"
              className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    id="payment-breakdown-title"
                    className="text-lg font-semibold text-slate-800"
                  >
                    Payment breakdown
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Enter how much each person paid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModal(false)}
                  aria-label="Close payment breakdown"
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              <PayBreakdown
                heading="Amount paid by each person"
                desc="Amounts must add up to the expense total."
                selectedParticipants={selectedParticipants}
                idPart="payment"
                handleChange={handleBreakdownChange}
                getter={payments}
                setter={setPayments}
                field="amount"
                totalHeading="Total paid"
                totalAmount={totalPayment}
                errors={paymentError}
                showRupee
              />
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPaymentModal(false)}
                  className="btn invitation-btn edit-text edit-btn-shadow"
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        )}
        {splitModal && splitMethod?.value !== "equal" && (
          <div
            className="outer-modal z-[80]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSplitModal(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="split-breakdown-title"
              className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    id="split-breakdown-title"
                    className="text-lg font-semibold text-slate-800"
                  >
                    {splitMethod?.value === "amount"
                      ? "Custom split breakdown"
                      : "Percentage split breakdown"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {splitMethod?.value === "amount"
                      ? "Enter each person's share of the expense."
                      : "Enter the percentage assigned to each person."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitModal(false)}
                  aria-label="Close split breakdown"
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              {splitMethod?.value === "amount" ? (
                <PayBreakdown
                  heading=""
                  desc=""
                  selectedParticipants={selectedParticipants}
                  idPart="split-amount"
                  handleChange={handleBreakdownChange}
                  getter={splitAmounts}
                  setter={setSplitAmounts}
                  field="amount"
                  totalHeading="Total split"
                  totalAmount={totalSplitAmount}
                  errors={splitError}
                  showRupee
                />
              ) : (
                <PayBreakdown
                  heading=""
                  desc=""
                  selectedParticipants={selectedParticipants}
                  idPart="split-percentage"
                  handleChange={handleBreakdownChange}
                  getter={splitPercentages}
                  setter={setSplitPercentages}
                  field="percentage"
                  totalHeading="Total percentage"
                  totalAmount={totalSplitPercentage}
                  errors={splitError}
                  showRupee={false}
                />
              )}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSplitModal(false)}
                  className="btn invitation-btn edit-text edit-btn-shadow"
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddExpense;
