import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import Error from "../error/Error";
import InvitationActionButton from "./InvitationActionButton";
import InviterDetail from "./InviterDetail";
import ReceivedAndSentButton from "./ReceivedAndSentButton";

const FriendsInvitations = ({
  sentInvitations,
  setSentInvitations,
  onInvitationAccepted,
}) => {
  const [visible, setVisible] = useState("received");
  const [receivedInvitations, setReceivedInvitations] = useState([]);
  // sentInvitations state is in Dashboard
  const [pageErrors, setPageErrors] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState([false, null]);

  const getReceivedInvitations = async () => {
    try {
      const response = await api.get("/friends/invitations/received");
      setReceivedInvitations(response.data);
    } catch (error) {
      setPageErrors([error.response?.data.error]);
    }
  };

  // initial received invitations
  useEffect(() => {
    getReceivedInvitations();
  }, []);

  const handleInvitationActionButtonClick = async (id, value) => {
    try {
      const response = await api.patch(`/friends/invitations/${id}`, {
        status: value,
      });

      //   remove this invitation from invitations feed
      setReceivedInvitations((prevInvitation) =>
        prevInvitation.filter((invitation) => invitation.id !== id),
      );

      //   if invitation accepted then call onInvitationAccepted (getFriends) to load new friends in sidebar
      if (value == "ACCEPTED") {
        await onInvitationAccepted();
      }
    } catch (error) {
      setPageErrors([error.response?.data.error]);
    }
  };

  const handleInvitationCancel = async (id) => {
    try {
      const response = await api.delete(`/friends/invitations/${id}`);
      console.log(response.data);

      //   remove this cancelled invitation from invitations feed
      setSentInvitations((prevInvitation) =>
        prevInvitation.filter((invitation) => invitation.id !== id),
      );
    } catch (error) {
      setPageErrors([error.response?.data.error]);
    }
  };

  return (
    <div className="mx-4">
      <h1 className="text-2xl heading-shadow text-center py-4 pt-6">
        Friends Invitations
      </h1>

      {/* sent or received toggles */}
      <div className="flex gap-3 pb-4">
        <ReceivedAndSentButton
          value={"received"}
          visible={visible}
          onClick={() => setVisible("received")}
        />
        <ReceivedAndSentButton
          value={"sent"}
          visible={visible}
          onClick={() => setVisible("sent")}
        />
      </div>

      {pageErrors.length > 0 && <Error errors={pageErrors} />}

      <main>
        {/* received invitations */}
        {visible == "received" ? (
          receivedInvitations.length > 0 ? (
            <ul>
              {receivedInvitations.map((invite) => (
                <div key={invite.id} className="flex gap-2 items-center py-4">
                  <img
                    onClick={() => setShowProfileModal([true, invite])}
                    className="small-img !w-16 !h-16"
                    src={invite.inviter.profile_picture_path}
                    alt={invite.inviter.name}
                  />
                  <div className="flex flex-col gap-2">
                    <h1 className="text-slate-700 font-medium">
                      {invite.inviter.name}
                    </h1>
                    <div className="flex gap-2">
                      <InvitationActionButton
                        value={"Accept"}
                        btnClass={"accpet-btn-shadow"}
                        onClick={() =>
                          handleInvitationActionButtonClick(
                            invite.id,
                            "ACCEPTED",
                          )
                        }
                      />
                      <InvitationActionButton
                        value={"Reject"}
                        btnClass={"reject-btn-shadow"}
                        onClick={() =>
                          handleInvitationActionButtonClick(
                            invite.id,
                            "REJECTED",
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </ul>
          ) : (
            <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
              You don't have any pending invitations.
              <br />
              <span className="text-sm font-normal text-slate-400">
                Send an invitation and start making friends.
              </span>
            </h1>
          )
        ) : // sent invitations
        sentInvitations.length > 0 ? (
          <ul>
            {sentInvitations.map((invitation) => (
              <div key={invitation.id} className="flex gap-2 items-center py-4">
                <div className="flex gap-2">
                  <img
                    onClick={() =>
                      invitation.invitee &&
                      setShowProfileModal([true, invitation])
                    }
                    className={`small-img !w-16 !h-16 ${!invitation.invitee && "hover:scale-100 hover:cursor-default"}`}
                    src={
                      invitation.invitee
                        ? invitation.invitee.profile_picture_path
                        : "/guest.jpg"
                    }
                    alt={invitation.invitee ? invitation.invitee.name : "Guest"}
                  ></img>{" "}
                  <div className="flex flex-col gap-1 items-start">
                    <h1 className="text-slate-700 font-medium">
                      {invitation.invitee
                        ? invitation.invitee.name
                        : invitation.invitee_email ||
                          invitation.invitee_mobile_number}
                    </h1>
                    <InvitationActionButton
                      value={"Cancel"}
                      btnClass={"reject-btn-shadow"}
                      onClick={() => handleInvitationCancel(invitation.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </ul>
        ) : (
          <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
            You don't have any sent invitations.
            <br />
            <span className="text-sm font-normal text-slate-400">
              Send an invitation and start making friends.
            </span>
          </h1>
        )}
      </main>

      {showProfileModal[0] && (
        <InviterDetail
          onClose={() => setShowProfileModal([false, null])}
          user={
            showProfileModal[1].inviter
              ? showProfileModal[1].inviter
              : showProfileModal[1].invitee
          }
          date={showProfileModal[1].created_at}
          message={
            showProfileModal[1].inviter
              ? "Wants to be your friend"
              : "You sent a friend request"
          }
        />
      )}
    </div>
  );
};

export default FriendsInvitations;
