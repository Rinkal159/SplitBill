import React from "react";

// Accept, Reject or Cancel

function InvitationActionButton({value, btnClass, onClick, loading = false, loadingValue = ""}) {
  return <button disabled={loading} className={`invitation-btn ${btnClass} ${loading && `opacity-50`}`} onClick={onClick}>{loading ? loadingValue : value}</button>;
}

export default InvitationActionButton;
