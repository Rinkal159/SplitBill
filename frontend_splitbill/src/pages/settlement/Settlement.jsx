import React, { useEffect, useState } from "react";
import formatAmount from "../../utils/formatAmount";
import SelectMenu from "../expense/SelectMenu";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";
import api from "../../api/axios";
import Error from "../error/Error";

function Settlement({
  onClose,
  toUser,
  settlementValue,
  overallValue,
  onSettlementRequestSent,
  setFriendExpensesLoading,
  loadSentSettlementReuqests,
  shouldIntializeWithOverall,
}) {
  console.log("OVERALL: ", overallValue);

  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const overallOption = {
    value: "overall",
    label: "Overall",
    debtAmount: formatAmount(Math.abs(overallValue)),
    isOverall: true,
  };
  const [settlement, setSettlement] = useState({
    to_user: toUser.id,
    amount: settlementValue,
    payment_method: "cash",
    note: null,
    settlement_date: localToday,
    group_id: null,
  });
  const [groupsInDebt, setGroupsInDebt] = useState([]);
  const [selectedSettlementOption, setSelectedSettlementOption] = useState(
    overallValue < 0 && shouldIntializeWithOverall && overallOption,
  );

  // loading
  const [settlementDataLoading, setsettlementDataLoading] = useState(true);
  const [settleLoading, setSettleLoading] = useState(false);

  // error
  const [frontErrors, setFrontErrors] = useState([]);
  const [backErrors, setBackErrors] = useState({});

  // The amount limit follows the currently selected scope.
  const initialAmount = Number(selectedSettlementOption.debtAmount);

  // cash modal
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);

  const getGroupsInWhichYouInDebt = async () => {
    try {
      const res = await api.get(`/expenses/groups/debt/${toUser.id}`);
      setGroupsInDebt(
        res.data.map(({ group, debt_amount }) => ({
          value: group.id,
          label: group.name,
          debtAmount: Number(debt_amount),
        })),
      );
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setsettlementDataLoading(false);
    }
  };

  useEffect(() => {
    getGroupsInWhichYouInDebt();
  }, []);

  const onAmountChange = (e) => {
    setFrontErrors([]);
    setBackErrors({});

    const amount = e.target.value;

    if (Number(amount) > initialAmount) {
      setFrontErrors(["Settlement amount cannot be greater than debt amount"]);
    } else if (Number(amount) <= 0) {
      setFrontErrors([
        "Settlement amount cannot be less than or equals to zero",
      ]);
    }

    setSettlement((prev) => ({
      ...prev,
      amount: Number(e.target.value.replace(/[^0-9.]/g, "")),
    }));
  };

  const handleSubmit = (e) => {
    try {
      e.preventDefault();

      if (settlement.payment_method.toLowerCase() === "cash") {
        setShowCashConfirmModal(true);
      }
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  const handleCashConfirmationSubmit = async () => {
    try {
      setSettleLoading(true);
      setShowCashConfirmModal(false);
      const res = await api.post("/settlements", settlement);
      onClose();

      setFriendExpensesLoading(true);
      await onSettlementRequestSent();

      await loadSentSettlementReuqests();
    } catch (error) {
      setSettleLoading(false);
      setBackErrors(getBackendError(error));
    }
  };

  return (
    <div className="outer-modal">
      <div
        className="inner-modal max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button type="button" onClick={onClose} className="cancel-icon">
          ✕
        </button>

        <p className="text-center text-sm text-slate-500">
          Settle with <span className="glittery-shadow">{toUser.name}</span>
        </p>

        <form
          action=""
          className="flex w-full flex-col items-center gap-4 pt-3"
        >
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-medium text-slate-700">₹</span>
            <input
              onChange={(e) => onAmountChange(e)}
              style={{
                width: `${Math.max(settlement.amount.length, 1)}ch`,
              }}
              className="border-b-2 border-dashed border-slate-300 bg-transparent pb-1 text-center text-4xl font-medium text-slate-700 focus:outline-none focus:ring-0"
              type="text"
              inputMode="decimal"
              value={settlement.amount}
              autoFocus
            />
          </div>

          {settlementDataLoading ? (
            <div className="flex justify-center">
              {" "}
              <Loading msg={"Settlement loading"} />{" "}
            </div>
          ) : (
            <div className="flex w-full flex-col space-y-3">
              {frontErrors.length > 0 && <Error errors={frontErrors} />}
              {Object.keys(backErrors).length !== 0 && (
                <Error errors={backErrors.error} type={backErrors.type} />
              )}
              <SelectMenu
                options={[
                  ...(overallValue < 0 && overallOption ? [overallOption] : []),
                  ...groupsInDebt,
                ]}
                value={selectedSettlementOption}
                onChange={(option) => {
                  const selectedOption = option ?? overallOption;
                  setSelectedSettlementOption(selectedOption);
                  setFrontErrors([]);
                  setBackErrors({});
                  setSettlement((prev) => ({
                    ...prev,
                    amount: Number(formatAmount(selectedOption.debtAmount)),
                    group_id: selectedOption.isOverall
                      ? null
                      : Number(selectedOption.value),
                  }));
                }}
                field="settlement-group"
                label="Choose settlement"
                placeholder="Select Overall or a group"
                isMultiSelect={false}
                closeMenuOnSelect={true}
                required={false}
                formatOptionLabel={(option) => (
                  <div className="flex w-full items-center justify-between gap-6">
                    <span>{option.label}</span>
                    <span className="font-medium text-slate-600">
                      ₹{formatAmount(option.debtAmount)}
                    </span>
                  </div>
                )}
              />

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="form-lbl" htmlFor="settlement-date">
                    Settlement date <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="form-input py-2"
                    id="settlement-date"
                    name="settlement_date"
                    type="date"
                    value={settlement.settlement_date}
                    onChange={(e) =>
                      setSettlement((prev) => ({
                        ...prev,
                        settlement_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="form-lbl" htmlFor="payment-method">
                    Payment method
                  </label>
                  <input
                    className="form-input py-2"
                    id="payment-method"
                    name="payment_method"
                    type="text"
                    maxLength={30}
                    placeholder="e.g. UPI, cash"
                    value={settlement.payment_method}
                    onChange={(e) =>
                      setSettlement((prev) => ({
                        ...prev,
                        payment_method: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="w-full space-y-1">
                <label className="form-lbl" htmlFor="settlement-note">
                  Note
                </label>
                <textarea
                  className="form-input min-h-16 resize-y"
                  id="settlement-note"
                  name="note"
                  maxLength={1500}
                  placeholder="Add a note (optional)"
                  value={settlement.note}
                  onChange={(e) =>
                    setSettlement((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                />
              </div>

              <button
                onClick={handleSubmit}
                className="btn text-md disabled:text-sky-800 border disabled:border-2 disabled:border-blue-200 invitation-btn edit-text edit-btn-shadow self-center px-4 py-1.5"
                type="submit"
                disabled={
                  settleLoading ||
                  frontErrors.length !== 0 ||
                  Object.keys(backErrors).length !== 0
                }
              >
                {settleLoading ? "Sending Settlement Request..." : "Settle up"}
              </button>
            </div>
          )}
        </form>
      </div>

      {showCashConfirmModal && (
        <div className="outer-modal">
          <div
            className="inner-modal max-w-sm space-y-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowCashConfirmModal(false)}
              className="cancel-icon"
            >
              ✕
            </button>

            <h1 className="glittery-shadow text-center text-lg font-semibold">
              Cash settlement confirmation
            </h1>

            <p className="text-center text-sm leading-6 text-slate-600">
              You’re about to record a cash payment of{" "}
              <span className="font-semibold text-slate-800">
                ₹{formatAmount(settlement.amount)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {toUser.name}
              </span>
              . They’ll be notified and asked to confirm receipt. The settlement
              will be marked complete once they confirm.
            </p>

            <button
              type="button"
              onClick={handleCashConfirmationSubmit}
              className="w-full btn rounded-full"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settlement;
