import React, { useState } from "react";
import formatAmount from "../../utils/formatAmount";
import SelectMenu from "../expense/SelectMenu";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";
import api from "../../api/axios";
import Error from "../error/Error";
import getTodayDate from "../../utils/getTodayDate";
import CashConfirmationModal from "./CashConfirmationModal";
import SettlementAmountInput from "./SettlementAmountInput";
import LabelAndInput from "../auth/LabelAndInput";

function FriendSettlement({
  onClose,
  toUser,
  settlementValue,
  overallValue,
  individualValue,
  loadFriendExpenses,
  setFriendExpensesLoading,
  loadSentSettlementReuqests,
  activeFilter,
  settlementGroups = [],
  settlementGroupsLoading = false,
  loadDashboardData,
  isGroupOnlySettlement = false,
}) {
  // today local date
  const localToday = getTodayDate();

  // settlement method options
  const overallOption = {
    value: "overall",
    label: "Overall",
    debtAmount: Math.abs(Number(overallValue ?? 0)),
    isOverall: true,
  };
  const individualOption = {
    value: "individual",
    label: "Individual",
    debtAmount: Math.abs(Number(individualValue ?? 0)),
    isOverall: false,
    isIndividual: true,
  };

  // payload
  const [settlement, setSettlement] = useState({
    to_user: toUser.id,
    amount: settlementValue,
    payment_method: "cash",
    note: null,
    settlement_date: localToday,
    group_id: null,
  });

  // got from props, loads debt groups once in FriendExpenses page, and send those groups in props then
  const groupsInDebt = settlementGroups.map(({ group, debt_amount }) => ({
    value: group.id,
    label: group.name,
    debtAmount: Number(debt_amount),
  }));

  // settlement method
  const [selectedSettlementOption, setSelectedSettlementOption] = useState(
    !isGroupOnlySettlement && activeFilter == "all"
      ? overallValue < 0 && overallOption
      : !isGroupOnlySettlement && activeFilter == "individual expenses"
        ? individualValue < 0 && individualOption
        : [],
  );

  // loading
  const [settleLoading, setSettleLoading] = useState(false);

  // error
  const [frontErrors, setFrontErrors] = useState([]);
  const [backErrors, setBackErrors] = useState({});

  // The amount limit follows the currently selected scope.
  const initialAmount = Number(selectedSettlementOption?.debtAmount ?? 0);

  // cash modal
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);

  const onAmountChange = (e) => {
    setFrontErrors([]);
    setBackErrors({});

    const amount = e.target.value;

    let compareAmount;
    if (selectedSettlementOption.length > 0) {
      compareAmount = initialAmount;
    } else {
      compareAmount = settlementValue;
    }

    if (Number(amount) > compareAmount) {
      setFrontErrors(["Settlement amount cannot be greater than debt amount"]);
    }
    if (Number(amount) <= 0) {
      setFrontErrors([
        "Settlement amount cannot be less than or equals to zero",
      ]);
    }

    setSettlement((prev) => ({
      ...prev,
      amount: Number(e.target.value.replace(/[^0-9.]/g, "")),
    }));
  };

  const submitSettlementRequest = async () => {
    try {
      setSettleLoading(true);
      setShowCashConfirmModal(false);
      if (selectedSettlementOption?.isIndividual) {
        await api.post("/settlements/individual", {
          to_user: settlement.to_user,
          amount: settlement.amount,
          payment_method: settlement.payment_method,
          note: settlement.note,
          settlement_date: settlement.settlement_date,
        });
      } else {
        await api.post("/settlements", settlement);
      }
      onClose();
      setFriendExpensesLoading(true);
      await loadFriendExpenses();
      await loadSentSettlementReuqests();
      await loadDashboardData();
    } catch (error) {
      setSettleLoading(false);
      setBackErrors(getBackendError(error));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (settlement.payment_method.toLowerCase() === "cash") {
      setShowCashConfirmModal(true);
    } else {
      submitSettlementRequest();
    }
  };

  return (
    <div className="outer-modal">
      <div
        className="inner-modal max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
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
          {isGroupOnlySettlement ? "Settle group expenses with " : "Settle with "}
          <span className="glittery-shadow">{toUser.name}</span>
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col items-center gap-4 pt-3"
        >
          {/* settlement amount input */}
          <SettlementAmountInput
            onChangeEvent={(e) => onAmountChange(e)}
            amount={settlement.amount}
            initialAmount={settlementValue}
          />

          {settlementGroupsLoading ? (
            <div className="flex justify-center">
              {" "}
              <Loading msg={"Settlement loading"} />{" "}
            </div>
          ) : (
            <div className="flex w-full flex-col space-y-3">
              {/* frontend error */}
              {frontErrors.length > 0 && <Error errors={frontErrors} />}

              {/* backend error */}
              {Object.keys(backErrors).length !== 0 && (
                <Error errors={backErrors.error} type={backErrors.type} />
              )}

              <SelectMenu
                options={[
                  ...(!isGroupOnlySettlement && overallValue < 0 ? [overallOption] : []),
                  ...(!isGroupOnlySettlement && individualValue < 0 ? [individualOption] : []),
                  ...groupsInDebt,
                ]}
                value={selectedSettlementOption}
                onChange={(option) => {
                  const selectedOption = option ?? (isGroupOnlySettlement ? null : overallOption);
                  setSelectedSettlementOption(selectedOption ?? []);
                  setFrontErrors([]);
                  setBackErrors({});
                  setSettlement((prev) => ({
                    ...prev,
                    amount: Number(selectedOption?.debtAmount ?? 0),
                    group_id:
                      !selectedOption || selectedOption.isOverall || selectedOption.isIndividual
                        ? null
                        : Number(selectedOption.value),
                  }));
                }}
                field="settlement-group"
                label="Choose settlement"
                placeholder="Select an expense scope or group"
                isMultiSelect={false}
                closeMenuOnSelect={true}
                required={isGroupOnlySettlement}
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

              <div className="w-full mb-4">
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
                className="btn text-md disabled:text-sky-800 border disabled:border-2 disabled:border-blue-200 invitation-btn edit-text edit-btn-shadow self-center px-4 py-1.5"
                type="submit"
                disabled={
                  settleLoading ||
                  (isGroupOnlySettlement && !selectedSettlementOption?.value) ||
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
        <CashConfirmationModal
          onClose={() => setShowCashConfirmModal(false)}
          firstMessage={
            <>
              You’re about to record a cash payment of{" "}
              <span className="font-semibold text-slate-800">
                ₹{formatAmount(settlement.amount)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {toUser.name}
              </span>{" "}
            </>
          }
          secondMessage={
            "They’ll be notified and asked to confirm receipt. The settlement will be marked complete once they confirm."
          }
          onSubmit={submitSettlementRequest}
        />
      )}
    </div>
  );
}

export default FriendSettlement;
