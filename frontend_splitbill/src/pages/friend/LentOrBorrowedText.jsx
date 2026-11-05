import React from "react";

function LentOrBorrowedText({expenses}) {
  return expenses.total_balance == 0
    ? expenses.settlements.length > 0 && (
        <p>
          You are <span className="accept-text">settled</span>
        </p>
      )
    : expenses.settlements.length > 0 && (
        <p className="text-slate-600">
          You{" "}
          <span className="font-medium">
            {expenses.total_balance < 0 ? "borrowed" : "lent"}
          </span>{" "}
          <span
            className={`${expenses.total_balance < 0 ? "reject-text" : "accept-text"}`}
          >
            {expenses.total_balance}
          </span>
        </p>
      );
}

export default LentOrBorrowedText;
