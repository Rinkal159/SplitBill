import React from "react";

function CashConfirmationModal({onClose, firstMessage, secondMessage, onSubmit}) {
  return (
    <div className="outer-modal">
      <div
        className="inner-modal max-w-sm space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="cancel-icon"
        >
          ✕
        </button>

        <h1 className="glittery-shadow text-center text-lg font-semibold">
          Cash settlement confirmation
        </h1>

        <p className="text-center text-sm leading-6 text-slate-600">
          {firstMessage} {secondMessage}
        </p>

        <button
          type="button"
          onClick={onSubmit}
          className="w-full btn rounded-full"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default CashConfirmationModal;
