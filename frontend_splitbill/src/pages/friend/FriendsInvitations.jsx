import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import Error from "../error/Error";
import InvitationActionButton from "./InvitationActionButton";
import InviterDetail from "./InviterDetail";
import ReceivedAndSentButton from "./ReceivedAndSentButton";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";
import LoadMore from "../common/LoadMore";

const PAGE_SIZE = 10;

export default function FriendsInvitations({
  sentInvitations,
  setSentInvitations,
  onInvitationAccepted,
  sentFriendInvitationsLoading,
}) {
  const [visible, setVisible] = useState("received");
  const [receivedInvitations, setReceivedInvitations] = useState([]);
  const [receivedPage, setReceivedPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);
  const [receivedHasMore, setReceivedHasMore] = useState(false);
  const [sentHasMore, setSentHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // sentInvitations state is in Dashboard
  const [showProfileModal, setShowProfileModal] = useState([false, null]);

  // loading
  const [loading, setLoading] = useState({
    sent: true, // not used, loading for sent is coming from dashboard
    received: true,
  });

  // error
  const [backErrors, setBackErrors] = useState({});

  const getReceivedInvitations = async (page = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      const response = await api.get("/friends/invitations/received/page", { params: { page, limit: PAGE_SIZE } });
      setReceivedInvitations((previous) => append ? [...previous, ...response.data.items] : response.data.items);
      setReceivedPage(response.data.page);
      setReceivedHasMore(response.data.has_more);

      setLoading((prevLoading) => ({
        ...prevLoading,
        received: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoadingMore(false);
    }
  };

  const getSentInvitations = async (page = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading((prev) => ({ ...prev, sent: true }));
      const response = await api.get("/friends/invitations/sent/page", { params: { page, limit: PAGE_SIZE } });
      setSentInvitations((previous) => append ? [...previous, ...response.data.items] : response.data.items);
      setSentPage(response.data.page);
      setSentHasMore(response.data.has_more);
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading((prev) => ({ ...prev, sent: false }));
      setLoadingMore(false);
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
      setBackErrors(getBackendError(error));
    }
  };

  const handleInvitationCancel = async (id) => {
    try {
      const response = await api.delete(`/friends/invitations/${id}`);

      //   remove this cancelled invitation from invitations feed
      setSentInvitations((prevInvitation) =>
        prevInvitation.filter((invitation) => invitation.id !== id),
      );
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  return (
    <div className="">
      <h1 className="text-2xl heading glittery-shadow text-center py-4 pt-6">
        Friends Invitations
      </h1>

      {/* sent or received toggles */}
      <div className="flex gap-3 pb-4 px-4">
        <ReceivedAndSentButton
          value={"received"}
          visible={visible}
          onClick={() => { setVisible("received"); if (!loading.received) getReceivedInvitations(); }}
        />
        <ReceivedAndSentButton
          value={"sent"}
          visible={visible}
          onClick={() => { setVisible("sent"); getSentInvitations(); }}
        />
      </div>

      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}

      <main>
        {/* received invitations */}
        {visible == "received" ? (
          loading.received ? (
            <div className="flex justify-center">
              <Loading msg={"Received friend invitations"} padding={false} />
            </div>
          ) : receivedInvitations.length > 0 ? (
            <ul>
              {receivedInvitations.map((invite) => (
                <div
                  key={invite.id}
                  className="flex gap-3 items-center p-4 py-5"
                >
                  <img
                    onClick={() => setShowProfileModal([true, invite])}
                    className="invite-img"
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
                        btnClass={"accept-text accept-btn-shadow"}
                        onClick={() =>
                          handleInvitationActionButtonClick(
                            invite.id,
                            "ACCEPTED",
                          )
                        }
                      />
                      <InvitationActionButton
                        value={"Reject"}
                        btnClass={"reject-text reject-btn-shadow"}
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
              You don't have any pending friend invitations.
              <br />
              <span className="text-sm font-normal text-slate-400 italic">
                Send an invitation and start making friends.
              </span>
            </h1>
          )
        ) : // sent invitations
        (loading.sent || sentFriendInvitationsLoading) ? (
          <div className="flex justify-center">
            <Loading msg={"Sent friend invitations"} padding={false} />
          </div>
        ) : sentInvitations.length > 0 ? (
          <ul>
            {sentInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="group flex gap-2 items-center p-4 py-5 box"
              >
                <div className="flex gap-2">
                  <img
                    onClick={() =>
                      invitation.invitee &&
                      setShowProfileModal([true, invitation])
                    }
                    className={`invite-img trans ${invitation.invitee && "group-hover:scale-105 hover:cursor-pointer"}`}
                    src={
                      invitation.invitee
                        ? invitation.invitee.profile_picture_path
                        : "/guest.jpg"
                    }
                    alt={invitation.invitee ? invitation.invitee.name : "Guest"}
                  ></img>{" "}
                  <div className="flex flex-col gap-1 items-start">
                    <h1
                      onClick={() =>
                        invitation.invitee &&
                        setShowProfileModal([true, invitation])
                      }
                      className="text-slate-700 font-medium group-hover:glittery-shadow hover:cursor-pointer hover:underline"
                    >
                      {invitation.invitee
                        ? invitation.invitee.name
                        : invitation.invitee_email ||
                          invitation.invitee_mobile_number}
                    </h1>
                    <InvitationActionButton
                      value={"Cancel"}
                      btnClass={"reject-text reject-btn-shadow"}
                      onClick={() => handleInvitationCancel(invitation.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </ul>
        ) : (
          <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
            You don't have any sent friend invitations.
            <br />
            <span className="text-sm font-normal text-slate-400 italic">
              Send an invitation and start making friends.
            </span>
          </h1>
        )}
      </main>

      <LoadMore
        hasMore={visible === "received" ? receivedHasMore : sentHasMore}
        loading={loadingMore}
        label="invitations"
        onClick={() => visible === "received"
          ? getReceivedInvitations(receivedPage + 1, true)
          : getSentInvitations(sentPage + 1, true)}
      />

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
}
