import { useMemo, useState } from "react";
import api from "../../api/axios";
import formatAmount from "../../utils/formatAmount";
import getBackendError from "../../utils/getBackendError";
import SelectMenu from "../expense/SelectMenu";
import Error from "../error/Error";

function GroupSettlement({
  group,
  expenses,
  onClose,
  onSettlementRequestSent,
}) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [settlementDate, setSettlementDate] = useState(localToday);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showCashConfirmation, setShowCashConfirmation] = useState(false);

  const membersById = useMemo(() => {
    const result = {};
    expenses.expenses.forEach((entry) => {
      entry.your_settlements.forEach((settlement) => {
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
    setErrors({});
  };

  const sendRequests = async () => {
    try {
      setLoading(true);
      const settlements = selectedMembers.map((member) => ({
        to_user: member.value,
        amount: Number(amounts[member.value]),
      }));
      await api.post("/settlements/groups", {
        group_id: group.id,
        settlements,
        payment_method: paymentMethod,
        note: note || null,
        settlement_date: settlementDate,
      });
      await onSettlementRequestSent();
      onClose();
    } catch (error) {
      setErrors(getBackendError(error));
      setLoading(false);
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
      setErrors({ error: ["Choose at least one member to settle with"] });
      return;
    }
    if (invalid) {
      setErrors({
        error: [
          "Each amount must be greater than zero and no more than that member's debt",
        ],
      });
      return;
    }
    setErrors({});
    if (paymentMethod.toLowerCase() === "cash") setShowCashConfirmation(true);
    else sendRequests();
  };


  console.log("SELECTED MEMBERS: ", selectedMembers);
  

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
                    <span className="text-4xl font-medium text-slate-700">₹</span>
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
                <div className="space-y-1">
                  <label className="form-lbl" htmlFor="group-settlement-date">
                    Settlement date <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="form-input py-2"
                    id="group-settlement-date"
                    type="date"
                    value={settlementDate}
                    onChange={(event) => setSettlementDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="form-lbl" htmlFor="group-payment-method">
                    Payment method
                  </label>
                  <input
                    className="form-input py-2"
                    id="group-payment-method"
                    maxLength={30}
                    placeholder="e.g. UPI, cash"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  />
                </div>
              </div>

              <div className="w-full space-y-1">
                <label className="form-lbl" htmlFor="group-settlement-note">
                  Note
                </label>
                <textarea
                  className="form-input min-h-16 resize-y"
                  id="group-settlement-note"
                  maxLength={1500}
                  placeholder="Add a note (optional)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <button
                className="btn invitation-btn edit-text edit-btn-shadow self-center px-4 py-1.5"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending settlement requests..." : "Settle up"}
              </button>
            </div>
          )}
        </form>
      </div>

      {showCashConfirmation && (
        <div className="outer-modal">
          <div
            className="inner-modal max-w-sm space-y-4 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCashConfirmation(false)}
              className="cancel-icon"
            >
              ✕
            </button>
            <h1 className="glittery-shadow text-center text-lg font-semibold">
              Cash settlement confirmation
            </h1>
            <p className="text-center text-sm leading-6 text-slate-600">
              Send cash settlement requests to{" "}
              {selectedMembers
                .map(
                  (member) =>
                    `${member.label} (₹${formatAmount(amounts[member.value])})`,
                )
                .join(", ")}
              ? Each person will be asked to confirm receipt.
            </p>
            <button type="button" onClick={sendRequests} className="w-full btn">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupSettlement;
