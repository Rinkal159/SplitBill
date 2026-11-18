import { useEffect, useState } from "react";
import api from "../../api/axios";
import formatAmount from "../../utils/formatAmount";
import getBackendError from "../../utils/getBackendError";
import SelectMenu from "../expense/SelectMenu";
import Error from "../error/Error";
import Loading from "../loading/Loading";
import getTodayDate from "../../utils/getTodayDate";
import CashConfirmationModal from "./CashConfirmationModal";
import LabelAndInput from "../auth/LabelAndInput";
import SettlementAmountInput from "./SettlementAmountInput";

function ExpenseSettlement({
  expenseId,
  expenseTitle,
  participants,
  onClose,
  loadExpenses,
  setExpenseLoading,
  loadSentSettlementReuqests,
  loadDashboardData,
}) {
  // today local date
  const localToday = getTodayDate();

  // Build the select options from the current participants to avoid duplicates.
  const participantOptions = participants
    .filter((participant) => participant.amount < 0)
    .map((participant) => ({
      value: participant.to_user.id,
      label: participant.to_user.name,
      debtAmount: formatAmount(Math.abs(Number(participant.amount))),
    }));
  const selectAllOption = {
    value: "__select_all_participants__",
    label: "Select all participants",
    isSelectAll: true,
  };
  const options = [
    ...participantOptions,
    ...(participantOptions.length > 1 ? [selectAllOption] : []),
  ];

  const [selectedMembers, setSelectedMembers] = useState([]);
  const [amounts, setAmounts] = useState({});

  // payload
  const [settlement, setSettlement] = useState({
    group_id: null,
    settlement_date: localToday,
    payment_method: "cash",
    note: null,
  });

  // loading
  const [settleLoading, setSettleLoading] = useState(false);

  // error
  const [errors, setErrors] = useState({});

  const [showCashConfirmation, setShowCashConfirmation] = useState(false);

  const chooseMembers = (members) => {
    const next = members ?? [];
    setSelectedMembers(next);
    setAmounts((previous) => {
      const updated = {};
      next.forEach((member) => {
        updated[member.value] =
          previous[member.value] ?? String(member.debtAmount);
      });
      return updated;
    });
    setErrors({});
  };

  const handleMemberChange = (members) => {
    if (members?.some((member) => member.isSelectAll)) {
      chooseMembers(participantOptions);
      return;
    }
    chooseMembers(members);
  };

  const sendRequests = async () => {
    try {
      setSettleLoading(true);
      setShowCashConfirmation(false);

      const settlements = selectedMembers.map((member) => ({
        to_user: member.value,
        amount: Number(amounts[member.value]),
      }));

      await api.post("/settlements/expenses", {
        expense_id: expenseId,
        settlements: settlements,
        payment_method: settlement.payment_method,
        note: settlement.note,
        settlement_date: settlement.settlement_date,
      });

      onClose();
      setExpenseLoading(true);
      await loadExpenses();
      await loadSentSettlementReuqests();
      await loadDashboardData();
    } catch (error) {
      setErrors(getBackendError(error));
      setSubmitting(false);
      setShowCashConfirmation(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!selectedMembers.length) {
      setErrors({ error: ["Choose at least one participant to settle with"] });
      return;
    }
    const invalid = selectedMembers.some((member) => {
      const amount = Number(amounts[member.value]);
      return (
        !Number.isFinite(amount) || amount <= 0 || amount > member.debtAmount
      );
    });
    if (invalid) {
      setErrors({
        error: [
          "Each amount must be greater than zero and no more than that participant's debt",
        ],
      });
      return;
    }
    setErrors({});
    if (settlement.payment_method.toLowerCase() === "cash")
      setShowCashConfirmation(true);
    else sendRequests();
  };

  return (
    <div className="outer-modal">
      <div
        className="inner-modal max-w-lg p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense summary"
          className="cancel-icon"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
        
        <p className="text-center text-sm text-slate-500">
          Settle <span className="glittery-shadow">{expenseTitle}</span>
        </p>

        <form onSubmit={submit} className="flex w-full flex-col gap-4 pt-3">
          {participantOptions.length > 0 ? (
            <>
              <SelectMenu
                options={options}
                value={selectedMembers}
                onChange={handleMemberChange}
                field="expense-settlement-members"
                label="Who do you want to settle with?"
                placeholder="Choose one or more participants"
                isMultiSelect
                closeMenuOnSelect
                autoFocus
                defaultMenuIsOpen
                required
                formatOptionLabel={(option) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span>{option.label}</span>
                    {!option.isSelectAll && (
                      <span className="font-medium reject-text">
                        ₹{formatAmount(option.debtAmount)}
                      </span>
                    )}
                  </div>
                )}
              />
              {selectedMembers.length > 0 && (
                <div className="flex w-full flex-wrap gap-3">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.value}
                      className="flex w-fit min-w-[150px] max-w-full flex-col items-center gap-1 rounded-lg bg-sky-50 p-4 text-center"
                    >
                      {/* settlement amount input */}
                      <SettlementAmountInput
                        onChangeEvent={(event) =>
                          setAmounts((previous) => ({
                            ...previous,
                            [member.value]: event.target.value,
                          }))
                        }
                        amount={amounts[member.value] ?? ""}
                        initialAmount={member.debtAmount}
                      />
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(errors).length > 0 && (
                <Error errors={errors.error} type={errors.type} />
              )}

              {selectedMembers.length > 0 && (
                <div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <LabelAndInput
                      type={"date"}
                      field={"settlement-date"}
                      labelValue={"Settlement date"}
                      required={true}
                      person={settlement.settlement_date}
                      placeholder={"Enter Settlement date"}
                      handleEvent={(e) =>
                        setSettlement((prev) => ({
                          ...prev,
                          settlement_date: e.target.value,
                        }))
                      }
                      showError={false}
                    />
                    <LabelAndInput
                      type={"text"}
                      field={"payment-method"}
                      labelValue={"Payment method"}
                      required={false}
                      person={settlement.payment_method}
                      placeholder={"e.g. UPI, cash"}
                      handleEvent={(e) =>
                        setSettlement((prev) => ({
                          ...prev,
                          payment_method: e.target.value,
                        }))
                      }
                      showError={false}
                    />
                  </div>

                  <div className="w-full my-4">
                    <LabelAndInput
                      type={"text"}
                      field={"settlement-note"}
                      labelValue={"Settlement note"}
                      required={false}
                      person={settlement.note}
                      placeholder={"Add a note (optional)"}
                      handleEvent={(e) =>
                        setSettlement((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      showError={false}
                    />
                  </div>

                  <button
                    className="btn text-md disabled:text-sky-700 border disabled:border-2 disabled:border-blue-200 invitation-btn edit-text edit-btn-shadow self-center px-4 py-1.5"
                    type="submit"
                    disabled={settleLoading}
                  >
                    {settleLoading
                      ? "Sending settlement requests..."
                      : "Settle up"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">
              You don’t owe any participants for this expense.
            </p>
          )}
        </form>
      </div>

      {showCashConfirmation && (
        <CashConfirmationModal
          onClose={() => setShowCashConfirmation(false)}
          firstMessage={
            <>
              <p className="text-center text-sm leading-6 text-slate-600">
                Send cash settlement requests to{" "}
                {selectedMembers.map((member, index) => (
                  <span key={member.value}>
                    {index > 0 && ", "}
                    <span className="font-semibold">{member.label}</span> -
                    <span className="font-semibold">
                      ₹{formatAmount(amounts[member.value])}
                    </span>
                  </span>
                ))}
                ?
              </p>
            </>
          }
          secondMessage={
            "They’ll be notified and asked to confirm receipt. The settlement will be marked complete once they confirm."
          }
          onSubmit={sendRequests}
        />
      )}
    </div>
  );
}

export default ExpenseSettlement;
