import { useContext, useEffect, useState } from "react";
import Navbar from "../../layout/Navbar";
import LabelAndInput from "../auth/LabelAndInput";
import api from "../../api/axios";
import SelectMenu from "./SelectMenu";
import { AuthContext } from "../../context/AuthProvider";
import PayBreakdown from "./PayBreakdown";
import NavigationState from "./NavigationState";
import Error from "../error/Error";
import { useNavigate } from "react-router-dom";
import getBackendError from "../../utils/getBackendError";

function AddExpense() {
  const { user } = useContext(AuthContext);

  const [addLoading, setAddLoading] = useState(false);

  const [expense, setExpense] = useState({
    title: "",
    description: "",
    note: "",
    amount: 0,
    expense_date: null,
  });

  // error
  const [frontErrors, setFrontErrors] = useState([]);
  const [backErrors, setBackErrors] = useState({});

  const [friendOptions, setFriendOptions] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([
    {
      value: user.id,
      label: "You",
      isFixed: true,
    },
  ]);

  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [memberOptions, setMemberOptions] = useState([]);

  // not a state
  const paymentOptions = [
    { value: user.id, label: "You" },
    ...selectedParticipants.filter(
      (participant) => participant.value != user.id,
    ),
    {
      value: "multiple",
      label: "Multiple people",
    },
  ];
  const [paidBy, setPaidBy] = useState(null);
  const [payments, setPayments] = useState([]);

  // not a state
  const splitOptions = [
    {
      value: "equal",
      label: "Split equally",
    },
    {
      value: "amount",
      label: "Split by expense amounts",
    },
    {
      value: "percentage",
      label: "Split by percentages",
    },
  ];
  const [splitMethod, setSplitMethod] = useState(null);
  const [splitAmounts, setSplitAmounts] = useState([]);
  const [splitPercentages, setSplitPercentages] = useState([]);

  const calcTotal = (items, field) =>
    items.reduce((total, item) => total + Number(item[field] || 0), 0);

  const totalPayment = calcTotal(payments, "amount");
  const totalSplitAmount = calcTotal(splitAmounts, "amount");
  const totalSplitPercentage = calcTotal(splitPercentages, "percentage");
  const expenseAmount = Number(expense.amount);

  const isExpenseComplete = Boolean(
    expense.title.trim() &&
    Number.isFinite(expenseAmount) &&
    expenseAmount > 0 &&
    expense.expense_date,
  );

  const paymentTotalMatches = Math.abs(totalPayment - expenseAmount) < 0.005;
  const hasValidPayer = Boolean(
    paidBy?.value === "multiple" ||
    selectedParticipants.some(
      (participant) => participant.value === paidBy?.value,
    ),
  );
  const areParticipantsComplete =
    selectedParticipants.length > 1 && hasValidPayer && paymentTotalMatches;

  const isSplitComplete = Boolean(
    splitMethod?.value === "equal" ||
    (splitMethod?.value === "amount" &&
      Math.abs(totalSplitAmount - expenseAmount) < 0.005) ||
    (splitMethod?.value === "percentage" &&
      Math.abs(totalSplitPercentage - 100) < 0.01),
  );

  const errors = {
    total_paid:
      Math.abs(totalPayment - expenseAmount) >= 0.005
        ? "Total paid amount and Expense amount must be equal."
        : "",

    total_split_amount:
      splitMethod &&
      splitMethod.value === "amount" &&
      Math.abs(totalSplitAmount - expenseAmount) >= 0.005
        ? "Total split amount and expense amount must be equal."
        : "",

    total_split_percentage:
      splitMethod &&
      splitMethod.value === "percentage" &&
      Math.abs(totalSplitPercentage - 100) >= 0.01
        ? "Total percentage splits must be equal to 100."
        : "",
  };

  const navigationStates = [
    {
      value: "expense",
      label: "Expense",
      handleClick: () => setActiveState("expense"),
      completed: isExpenseComplete,
    },
    {
      value: "participants",
      label: "Participants",
      handleClick: () => setActiveState("participants"),
      completed: areParticipantsComplete,
    },
    {
      value: "splits",
      label: "Splits",
      handleClick: () => setActiveState("splits"),
      completed: isSplitComplete,
    },
  ];

  const [activeState, setActiveState] = useState("expense");

  // get friends for participants options
  const getFriends = async () => {
    try {
      const response = await api.get("/friends/name");

      const friendOptionsResponse = response.data.map((friend) => ({
        value: friend.id,
        label: friend.name,
      }));

      setFriendOptions(friendOptionsResponse);
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  // get groups in which you're a member
  const getGroups = async () => {
    try {
      const res = await api.get("/groups/name");

      const groupOptionsResponse = res.data.map((group) => ({
        value: group.group.id,
        label: group.group.name,
      }));

      setGroupOptions(groupOptionsResponse);
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  useEffect(() => {
    getFriends();
    getGroups();
  }, []);

  useEffect(() => {
    if (!selectedGroup) {
      setMemberOptions(friendOptions);
      return;
    }

    let ignore = false;

    const getMembers = async () => {
      try {
        const res = await api.get(`/groups/${selectedGroup.value}`);

        if (res.data.total_members <= 1) {
          if (ignore) return;
          setMemberOptions(friendOptions);
          setSelectedGroup(null);
          setFrontErrors(["Select a group with more than one member."]);
          return;
        }

        if (ignore) return;
        setMemberOptions(
          res.data.group.members.map((member) => ({
            value: member.user.id,
            label: member.user.name,
          })),
        );
      } catch (error) {
        if (ignore) return;
        setMemberOptions(friendOptions);
        setSelectedGroup(null);
        setBackErrors(getBackendError(error));
      }
    };

    getMembers();
    return () => {
      ignore = true;
    };
  }, [selectedGroup, friendOptions]);

  const handleChange = (e, field) => {
    setExpense((prevExpense) => ({
      ...prevExpense,
      [field]: e.target.value,
    }));
  };

  const handlePaidByChange = (selectedOption) => {
    setPaidBy(selectedOption);

    if (!selectedOption) {
      setPayments([]);
      return;
    }

    setPayments((previousPayments) =>
      selectedParticipants.map((participant) => {
        const previous = previousPayments.find(
          (payment) => payment.id === participant.value,
        );
        return {
          id: participant.value,
          name: participant.label,
          amount:
            selectedOption.value === "multiple"
              ? (previous?.amount ?? 0)
              : selectedOption.value === participant.value
                ? expenseAmount
                : 0,
        };
      }),
    );
  };

  const handlePayBreakdownChange = (e, participantId, setter, field) => {
    setter((prev) =>
      prev.map((payment) =>
        payment.id === participantId
          ? {
              ...payment,
              [field]: Number(e.target.value) || 0,
            }
          : payment,
      ),
    );
  };

  const handleSplitMethodChange = (selectedOption) => {
    setSplitMethod(selectedOption);
  };

  useEffect(() => {
    setSplitAmounts((previous) =>
      selectedParticipants.map((participant) => ({
        id: participant.value,
        name: participant.label,
        amount:
          previous.find((split) => split.id === participant.value)?.amount ?? 0,
      })),
    );
    setSplitPercentages((previous) =>
      selectedParticipants.map((participant) => ({
        id: participant.value,
        name: participant.label,
        percentage:
          previous.find((split) => split.id === participant.value)
            ?.percentage ?? 0,
      })),
    );

    if (
      paidBy &&
      paidBy.value !== "multiple" &&
      !selectedParticipants.some(
        (participant) => participant.value === paidBy.value,
      )
    ) {
      setPaidBy(null);
      setPayments([]);
      return;
    }

    setPayments((previous) =>
      selectedParticipants.map((participant) => {
        const previousPayment = previous.find(
          (payment) => payment.id === participant.value,
        );
        return {
          id: participant.value,
          name: participant.label,
          amount:
            paidBy?.value === "multiple"
              ? (previousPayment?.amount ?? 0)
              : paidBy?.value === participant.value
                ? expenseAmount
                : 0,
        };
      }),
    );
  }, [selectedParticipants, paidBy, expenseAmount]);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setAddLoading(true);

      let expense_splits = [];
      if (splitMethod.value === "amount") {
        expense_splits = splitAmounts.map((split) => {
          return {
            user_id: split.id,
            amount: split.amount,
          };
        });
      } else if (splitMethod.value === "percentage") {
        expense_splits = splitPercentages.map((split) => {
          return {
            user_id: split.id,
            percentage: split.percentage,
          };
        });
      } else {
        expense_splits = null;
      }
      const data = {
        group_id: selectedGroup ? selectedGroup.value : null,
        title: expense.title,
        description: expense.description || null,
        note: expense.note || null,
        total_amount: expense.amount,
        expense_date: expense.expense_date,
        participants: selectedParticipants.map(
          (participant) => participant.value,
        ),
        payments: payments.map((payment) => ({
          user_id: payment.id,
          amount: payment.amount,
        })),
        split_method: splitMethod.value,
        expense_splits: expense_splits,
      };

      await api.post("/expenses", data);

      return navigate("/dashboard");
    } catch (error) {
      setAddLoading(false);
      setBackErrors(getBackendError(error));
    }
  };

  return (
    <div>
      <Navbar />
      <div className="flex justify-center">
        {/* Left Column — Signup Form */}
        <div className="w-full max-w-3xl m-8 flex items-start justify-center lg:px-0 px-6 py-6 bg-white border border-blue-100/60 shadow-xl shadow-blue-100/90 bg-gradient-to-br from-blue-50/60 via-white to-blue-50/60">
          <div className="w-full max-w-2xl">
            <div className="mb-8 place-self-center text-center">
              <h2 className="text-2xl glittery-shadow p-2">Add expense</h2>
              <p className="text-sm text-slate-400 max-w-xs ">
                Start splitting expenses with friends.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex w-full mb-6">
                {navigationStates.map((state) => (
                  <NavigationState
                    key={state.value}
                    value={state.value}
                    label={state.label}
                    activeState={activeState}
                    handleClick={state.handleClick}
                    completed={state.completed}
                    disabled={
                      state.value === "participants"
                        ? !isExpenseComplete
                        : state.value === "splits"
                          ? !isExpenseComplete || !areParticipantsComplete
                          : false
                    }
                  />
                ))}
              </div>

              <div className="mb-6">
                {frontErrors.length > 0 && <Error errors={frontErrors} />}

                {Object.keys(backErrors).length !== 0 && (
                  <Error errors={backErrors.error} type={backErrors.type} />
                )}
              </div>

              <div className="min-h-[350px]">
                {/* Expense details */}
                {activeState === "expense" && (
                  <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6">
                    <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                      Expense details
                    </legend>

                    {/* title */}
                    <div>
                      <LabelAndInput
                        field={"title"}
                        labelValue={"Title"}
                        handleEvent={(e) => handleChange(e, "title")}
                        type={"text"}
                        person={expense}
                        placeholder={"Enter a title"}
                        required={true}
                      />
                    </div>

                    {/* description */}
                    <div className="space-y-2 mt-2">
                      <label className="form-lbl" htmlFor="description">
                        Description
                      </label>
                      <textarea
                        className="form-input"
                        rows={5}
                        onChange={(e) => handleChange(e, "description")}
                        value={expense.description}
                        name="description"
                        id="description"
                        placeholder="Enter a description"
                      ></textarea>
                    </div>

                    {/* amount and expense date */}
                    <div className="flex w-full items-start gap-6 mt-2">
                      {/* Amount */}
                      <div className="flex-1">
                        <LabelAndInput
                          field="amount"
                          labelValue="Amount"
                          handleEvent={(e) => handleChange(e, "amount")}
                          person={expense}
                          type="number"
                          placeholder="Enter expense amount"
                          required={true}
                        />
                      </div>

                      {/* Expense date */}
                      <div className="flex-1 space-y-2">
                        <label htmlFor="date" className="form-lbl">
                          Expense date
                          <span className="text-red-400 text-sm">*</span>
                        </label>

                        <input
                          className="form-input w-full"
                          type="date"
                          name="date"
                          id="date"
                          value={expense.expense_date}
                          onChange={(e) => handleChange(e, "expense_date")}
                          required
                        />
                      </div>
                    </div>

                    {/* attachment and note */}
                    <div className="flex w-full items-start gap-6 mt-2">
                      {/* Attachment */}
                      <div className="flex-1 space-y-2">
                        <label htmlFor="attachment" className="form-lbl">
                          Attachment
                        </label>

                        <input
                          className="form-input w-full"
                          type="file"
                          accept="image/*"
                          id="attachment"
                        />
                      </div>

                      {/* Note */}
                      <div className="flex-1">
                        <LabelAndInput
                          field="note"
                          labelValue="Note"
                          handleEvent={(e) => handleChange(e, "note")}
                          person={expense}
                          type="text"
                          placeholder="Enter a note"
                        />
                      </div>
                    </div>
                  </fieldset>
                )}

                {/* Participants */}
                {activeState === "participants" && (
                  <div className="space-y-4">
                    <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6">
                      <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                        Group
                      </legend>

                      <SelectMenu
                        label={"Choose Group"}
                        additionalInfo="If it is a group expense"
                        field={"group"}
                        options={groupOptions}
                        value={selectedGroup}
                        placeholder={"Select group"}
                        isMultiSelect={false}
                        closeMenuOnSelect={true}
                        required={false}
                        onChange={(group) => {
                          setFrontErrors([]);
                          setSelectedGroup(group);
                        }}
                      />
                    </fieldset>
                    <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6">
                      <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                        Participants
                      </legend>

                      {/* Participants */}
                      <div className="space-y-1.5">
                        <SelectMenu
                          options={memberOptions}
                          value={selectedParticipants}
                          onChange={setSelectedParticipants}
                          field="participants"
                          label="Participants"
                          placeholder="Search and select participants"
                          isMultiSelect={true}
                          closeMenuOnSelect={true}
                        />
                      </div>

                      {/* Payments + Payment breakdown */}
                      <div className="mt-4 flex items-start gap-6">
                        {/* Payments */}
                        <div className="flex-1 space-y-1.5">
                          <SelectMenu
                            options={paymentOptions}
                            value={paidBy}
                            onChange={handlePaidByChange}
                            field="payment"
                            label={"Paid by"}
                            placeholder="Paid by"
                            isMultiSelect={false}
                            closeMenuOnSelect={true}
                          />
                        </div>

                        {/* Payment breakdown */}
                        {paidBy && paidBy.value === "multiple" && (
                          <PayBreakdown
                            heading={"Payment breakdown"}
                            desc={"Enter how much each person paid."}
                            selectedParticipants={selectedParticipants}
                            idPart={"payment"}
                            handleChange={handlePayBreakdownChange}
                            getter={payments}
                            setter={setPayments}
                            field={"amount"}
                            totalHeading={"Total paid"}
                            totalAmount={totalPayment}
                            errors={errors.total_paid}
                            showRupee={true}
                          />
                        )}
                      </div>
                    </fieldset>
                  </div>
                )}

                {/* Splits */}
                {activeState === "splits" && (
                  <fieldset className="rounded-xl border border-blue-100 bg-white px-6 py-4 pb-6">
                    <legend className="px-3 text-base font-normal glittery-shadow text-md tracking-wide">
                      Splits
                    </legend>

                    {/* split method */}
                    <SelectMenu
                      options={splitOptions}
                      value={splitMethod}
                      onChange={handleSplitMethodChange}
                      field={"split"}
                      label={"Split method"}
                      placeholder={"Choose split method"}
                      isMultiSelect={false}
                      closeMenuOnSelect={true}
                    />

                    {splitMethod && splitMethod.value === "amount" && (
                      <PayBreakdown
                        heading={"Split breakdown by amount"}
                        desc={"Enter how much each person should pay."}
                        selectedParticipants={selectedParticipants}
                        idPart={"split-amount"}
                        handleChange={handlePayBreakdownChange}
                        getter={splitAmounts}
                        setter={setSplitAmounts}
                        field={"amount"}
                        totalHeading={"Total pay"}
                        totalAmount={totalSplitAmount}
                        errors={errors.total_split_amount}
                        showRupee={true}
                      />
                    )}

                    {splitMethod && splitMethod.value === "percentage" && (
                      <PayBreakdown
                        heading={"Split breakdown by percentage"}
                        desc={
                          "Enter how much each person should pay in percentage."
                        }
                        selectedParticipants={selectedParticipants}
                        idPart={"split-percentage"}
                        handleChange={handlePayBreakdownChange}
                        getter={splitPercentages}
                        setter={setSplitPercentages}
                        field={"percentage"}
                        totalHeading={"Total pay by percentage"}
                        totalAmount={totalSplitPercentage}
                        errors={errors.total_split_percentage}
                        showRupee={false}
                      />
                    )}
                  </fieldset>
                )}
              </div>

              {/* Submit Button */}
              <button
                disabled={
                  addLoading ||
                  !isExpenseComplete ||
                  !areParticipantsComplete ||
                  !isSplitComplete ||
                  Boolean(errors.total_paid) ||
                  Boolean(errors.total_split_amount) ||
                  Boolean(errors.total_split_percentage)
                }
                className={`btn ${addLoading && `opacity-50`}`}
                type="submit"
              >
                {addLoading ? "Adding..." : "Add expense"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddExpense;
