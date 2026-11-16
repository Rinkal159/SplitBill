import { useMemo, useState } from "react";
import api from "../../api/axios";
import formatAmount from "../../utils/formatAmount";
import getBackendError from "../../utils/getBackendError";
import SelectMenu from "../expense/SelectMenu";
import Error from "../error/Error";
import getTodayDate from "../../utils/getTodayDate";
import CashConfirmationModal from "./CashConfirmationModal";
import LabelAndInput from "../auth/LabelAndInput";

function GroupSettlement({
  group,
  expenses,
  onClose,
  loadGroupExpenses,
  setGroupExpenseLoading,
  loadSentSettlementReuqests,
  loadDashboardData
}) {
  // today local date
  const localToday = getTodayDate();

  // payload
  const [settlement, setSettlement] = useState({
    group_id: group.id,
    settlement_date: localToday,
    payment_method: "cash",
    note: null,
  });

  const [selectedMembers, setSelectedMembers] = useState([]);
  const [amounts, setAmounts] = useState({});

  // loading
  const [settleLoading, setSettleLoading] = useState(false);

  // error
  const [backErrors, setBackErrors] = useState({});

  // cash confirmation modal
  const [showCashConfirmation, setShowCashConfirmation] = useState(false);

  const membersById = useMemo(() => {
    const result = {};
    expenses.expenses.forEach((entry) => {
      entry.your_actual_settlements.forEach((settlement) => {
        result[settlement.to_user.id] = settlement.to_user;
      });
    });
    return result;
  }, [expenses]);

  const options = Object.entries(expenses.friend_balances)
    .filter(([id, balance]) => Number(balance) < 0 && membersById[id])
    .map(([id, balance]) => ({
      value: Number(id),
      label: membersById[id].name,
      debtAmount: Math.abs(Number(balance)),
      member: membersById[id],
    }));

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
    setBackErrors({});
  };

  const sendRequests = async () => {
    try {
      setSettleLoading(true);
      setShowCashConfirmation(false);

      const settlements = selectedMembers.map((member) => ({
        to_user: member.value,
        amount: Number(amounts[member.value]),
      }));

      await api.post("/settlements/groups", {
        group_id: settlement.group_id,
        settlements,
        settlement_date: settlement.settlement_date,
        payment_method: settlement.payment_method,
        note: settlement.note,
      });

      onClose();
      setGroupExpenseLoading(true);
      await loadGroupExpenses();
      await loadSentSettlementReuqests();
      await loadDashboardData();
    } catch (error) {
      setBackErrors(getBackendError(error));
      setSettleLoading(false);
      setShowCashConfirmation(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const invalid = selectedMembers.some((member) => {
      const amount = Number(amounts[member.value]);
      return (
        !Number.isFinite(amount) || amount <= 0 || amount > member.debtAmount
      );
    });
    if (selectedMembers.length === 0) {
      setBackErrors({ error: ["Choose at least one member to settle with"] });
      return;
    }
    if (invalid) {
      setBackErrors({
        error: [
          "Each amount must be greater than zero and no more than that member's debt",
        ],
      });
      return;
    }
    setBackErrors({});
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
        <button type="button" onClick={onClose} className="cancel-icon">
          ✕
        </button>
        <p className="text-center text-md text-slate-500">
          Settle up in <span className="glittery-shadow">{group.name}</span>
        </p>

        <form onSubmit={submit} className="flex w-full flex-col gap-4 pt-3">
          <SelectMenu
            options={options}
            value={selectedMembers}
            onChange={chooseMembers}
            field="group-settlement-members"
            label="Who do you want to settle with?"
            placeholder="Choose one or more members"
            isMultiSelect
            closeMenuOnSelect={true}
            required
            formatOptionLabel={(option) => (
              <div className="flex w-full items-center justify-between gap-4">
                <span>{option.label}</span>
                <span className="font-medium reject-text">
                  ₹{formatAmount(option.debtAmount)}
                </span>
              </div>
            )}
          />

          {selectedMembers.length > 0 && (
            <div className="flex w-full flex-wrap gap-3">
              {selectedMembers.map((member) => (
                <div
                  key={member.value}
                  className="flex w-fit min-w-[150px] max-w-full flex-col items-center gap-1 rounded-lg bg-sky-50 px-0 py-4 text-center"
                >
                  <div className="flex items-baseline justify-center gap-1 border-b-2 border-dashed border-slate-300">
                    <span className="text-4xl font-medium text-slate-700">
                      ₹
                    </span>
                    <input
                      id={`settlement-amount-${member.value}`}
                      onChange={(event) =>
                        setAmounts((previous) => ({
                          ...previous,
                          [member.value]: event.target.value,
                        }))
                      }
                      style={{
                        width: `${Math.max(String(amounts[member.value] ?? "").length, 1)}ch`,
                      }}
                      className=" bg-transparent pb-1 text-center text-4xl font-medium text-slate-700 focus:outline-none focus:ring-0"
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={amounts[member.value] ?? ""}
                      aria-label={`Settlement amount for ${member.label}`}
                    />
                  </div>
                  <p className="max-w-full truncate text-sm font-medium text-slate-600">
                    {member.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    Owes ₹{formatAmount(member.debtAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {Object.keys(backErrors).length > 0 && (
            <Error errors={backErrors.error} type={backErrors.type} />
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
                onClick={submit}
              >
                {settleLoading ? "Sending settlement requests..." : "Settle up"}
              </button>
            </div>
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
                    <span className="font-semibold">₹{formatAmount(amounts[member.value])}</span>
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

export default GroupSettlement;
