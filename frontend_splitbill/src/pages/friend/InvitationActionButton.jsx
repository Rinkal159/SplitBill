import React from "react";

// Accept, Reject or Cancel

function InvitationActionButton({value, btnClass, onClick}) {
  return <button className={`invitation-btn ${btnClass}`} onClick={onClick}>{value}</button>;
}

export default InvitationActionButton;
