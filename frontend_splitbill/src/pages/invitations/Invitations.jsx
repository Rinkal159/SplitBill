import React from "react";
import InviteSection from "./InviteSection";

function Invitations({ setContentRenderer, setActiveSubvalue }) {
  return (
    <div>
      <header>
        <h1 className="heading glittery-shadow">Invitations</h1>
      </header>

      <div className="flex flex-col gap-6 pt-6">
        <InviteSection
          setContentRenderer={setContentRenderer}
          setActiveSubvalue={setActiveSubvalue}
          contentRenderer={"FriendInvitations"}
          heading={"Friend invitations"}
          desc={
            "View friend requests you’ve received and invitations you’ve sent."
          }
        />

        <InviteSection
          setContentRenderer={setContentRenderer}
          setActiveSubvalue={setActiveSubvalue}
          contentRenderer={"GroupInvitations"}
          heading={"Group invitations"}
          desc={
            "Review group invites and check the requests you’ve sent."
          }
        />
      </div>
    </div>
  );
}

export default Invitations;
