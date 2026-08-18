import React from "react";

function ReceivedAndSentButton({visible, onClick, value}) {
  return (
    <button
      onClick={onClick}
      className={`${
        visible == value
          ? `heading-shadow border-sky-500`
          : `text-slate-500 hover:text-slate-700 hover:border-slate-400/80`
      } toggleButtons capitalize`}
    >
      {value}
    </button>
  );
}

export default ReceivedAndSentButton;
