import { useEffect, useState } from "react";
import api from "../../api/axios";
import ReceivedAndSentButton from "../friend/ReceivedAndSentButton";
import InvitationActionButton from "../friend/InvitationActionButton";
import InviterDetail from "../friend/InviterDetail";
import Filter from "./Filter";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";

function GroupInvitations({
  sentInvitations,
  setSentInvitations,
  onInvitationAccepted,
  sentGroupInvitationsLoading,
}) {
  const [visible, setVisible] = useState("received");
  const [receivedInvitations, setReceivedInvitations] = useState([]);
  // sentInvitations state is in Dashboard

  // loading
  const [loading, setLoading] = useState({
    sent: true,
    received: true,
  });

  // error
  const [backErrors, setBackErrors] = useState({});

  // loading ids
  const [cancelLoadingId, setCancelLoadingId] = useState(null);
  const [acceptLoadingId, setAcceptLoadingId] = useState(null);
  const [rejectLoadingId, setRejectLoadingId] = useState(null);

  // profile modal
  const [showProfileModal, setShowProfileModal] = useState([false, {}]);

  // filters
  const receivedFilters = ["all", "inviter"];
  const [activeReceivedFilter, setActiveReceivedFilter] = useState("all");
  const [filteredReceivedInvitations, setFilteredReceivedInvitations] =
    useState([]);

  const sentFilters = ["all", "group", "invitee"];
  const [activeSentFilter, setActiveSentFilter] = useState("all");
  const [filteredSentInvitations, setFilteredSentInvitations] =
    useState(sentInvitations);

  const groupsInvited = [
    ...new Map(
      sentInvitations.map((invitation) => [invitation.group.id, invitation]),
    ).values(),
  ];

  const inviteeInvited = [
    ...new Map(
      sentInvitations.map((invitation) => {
        const key =
          invitation.invitee?.id ||
          invitation.invitee_email ||
          invitation.invitee_mobile_number;
        return [key, invitation];
      }),
    ).values(),
  ];

  const inviters = [
    ...new Map(
      receivedInvitations.map((invitation) => [
        invitation.inviter.id,
        invitation,
      ]),
    ).values(),
  ];

  const getReceivedInvitations = async () => {
    try {
      const res = await api.get("/groups/invitations/received");
      setReceivedInvitations(res.data);

      setLoading((prevLoading) => ({
        ...prevLoading,
        received: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  const handleInvitationCancel = async (invite_id) => {
    try {
      setCancelLoadingId(invite_id);
      const res = await api.delete(`/groups/invitations/${invite_id}`);
      setSentInvitations((prevInvite) =>
        prevInvite.filter((invite) => invite.id !== invite_id),
      );
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setCancelLoadingId(null);
    }
  };

  const handleInvitationActionButtonClick = async (id, status) => {
    try {
      status === "ACCEPTED" ? setAcceptLoadingId(id) : setRejectLoadingId(id);
      const res = await api.patch(`/groups/invitations/${id}`, {
        status: status,
      });
      setReceivedInvitations((prevInvite) =>
        prevInvite.filter((invite) => invite.id !== id),
      );
      if (status === "ACCEPTED") {
        onInvitationAccepted();
      }
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setAcceptLoadingId(null);
      setRejectLoadingId(null);
    }
  };

  useEffect(() => {
    getReceivedInvitations();
  }, []);

  useEffect(() => {
    setFilteredReceivedInvitations(receivedInvitations);
  }, [receivedInvitations]);

  useEffect(() => {
    setFilteredSentInvitations(sentInvitations);
  }, [sentInvitations]);

  const handleSubvalueClick = (id, value) => {
    setActiveSentFilter(value);

    const invitations =
      value === "group"
        ? sentInvitations.filter((invite) => invite.group.id === id)
        : value === "invitee"
          ? sentInvitations.filter(
              (invite) =>
                invite.invitee?.id === id ||
                invite.invitee_email === id ||
                invite.invitee_mobile_number === id,
            )
          : sentInvitations;
    setFilteredSentInvitations(invitations);
  };

  const handleReceivedSubvalueClick = (id, value) => {
    setActiveReceivedFilter(value);

    const invitations =
      value === "inviter"
        ? receivedInvitations.filter((invite) => invite.inviter.id === id)
        : receivedInvitations;
    setFilteredReceivedInvitations(invitations);
  };

  return (
    <div>
      <h1 className="text-2xl glittery-shadow text-center p-4 pt-6">
        Group Invitations
      </h1>

      {/* sent or received toggles */}
      <div className="flex gap-3 pb-4 px-4">
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

      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}

      <main>
        {/* received invitations */}
        {visible == "received" ? (
          loading.received ? (
            <div className="flex justify-center">
              <Loading msg={"Received group invitations"} padding={false} />
            </div>
          ) : receivedInvitations.length > 0 ? (
            <>
              <div className="px-4 pb-4">
                {receivedFilters.map((filter, i) => (
                  <Filter
                    key={i}
                    value={filter}
                    subvalues={
                      filter === "inviter"
                        ? inviters.map((invitation) => ({
                            id: invitation.inviter.id,
                            value: invitation.inviter.name,
                          }))
                        : []
                    }
                    isActive={activeReceivedFilter === filter}
                    doApplyBorder={i !== receivedFilters.length - 1}
                    onClick={() => {
                      setActiveReceivedFilter(filter);

                      if (filter === "all") {
                        setFilteredReceivedInvitations(receivedInvitations);
                      }
                    }}
                    onSubvalueClick={handleReceivedSubvalueClick}
                  />
                ))}
              </div>
              <ul>
                {filteredReceivedInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-4 py-4 border-b border-slate-200 group px-4 box"
                  >
                    {/* Group Image */}
                    <img
                      className="
        w-16 h-16 rounded-full object-cover
        border-2 border-white shadow-md group-hover:scale-105 trans "
                      src={invite.group.group_picture_path}
                      alt={invite.group.name}
                    />

                    {/* Invitation Details */}
                    <div className="flex flex-1 flex-col gap-2 min-w-0">
                      <div className="min-w-0">
                        <h1 className="text-slate-700 font-semibold truncate group-hover:glittery-shadow  ">
                          {invite.group.name}
                        </h1>

                        <p className="text-slate-500 text-sm">
                          Invited by{" "}
                          <span
                            onClick={() => setShowProfileModal([true, invite])}
                            className="text-slate-600 font-medium
            hover:text-slate-700 hover:underline
            hover:cursor-pointer transition-all duration-200"
                          >
                            {invite.inviter.name}
                          </span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <InvitationActionButton
                          value="Accept"
                          btnClass="accept-text accpet-btn-shadow"
                          onClick={() =>
                            handleInvitationActionButtonClick(
                              invite.id,
                              "ACCEPTED",
                            )
                          }
                          loading={invite.id === acceptLoadingId}
                          loadingValue="Accepting..."
                        />

                        <InvitationActionButton
                          value="Reject"
                          btnClass="reject-text reject-btn-shadow"
                          onClick={() =>
                            handleInvitationActionButtonClick(
                              invite.id,
                              "REJECTED",
                            )
                          }
                          loading={invite.id === rejectLoadingId}
                          loadingValue="Rejecting..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </ul>
            </>
          ) : (
            <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
              You don't have any pending group invitations.
              <br />
              <span className="text-sm font-normal text-slate-400 italic">
                Create a group and send invitations.
              </span>
            </h1>
          ) // sent invitation
        ) : sentGroupInvitationsLoading ? (
          <div className="flex justify-center">
            <Loading msg={"Sent group invitations"} padding={false} />
          </div>
        ) : sentInvitations.length > 0 ? (
          <div>
            <div className="px-4 pb-4">
              {sentFilters.map((filter, i) => {
                return (
                  <Filter
                    value={filter}
                    subvalues={
                      filter === "group"
                        ? groupsInvited.map((invitation) => ({
                            id: invitation.group.id,
                            value: invitation.group.name,
                          }))
                        : filter === "invitee"
                          ? inviteeInvited.map((invitation) => ({
                              id:
                                invitation.invitee?.id ||
                                invitation.invitee_email ||
                                invitation.invitee_mobile_number,
                              value:
                                invitation.invitee?.name ||
                                invitation.invitee_email ||
                                invitation.invitee_mobile_number,
                            }))
                          : []
                    }
                    isActive={activeSentFilter === filter}
                    doApplyBorder={i !== sentFilters.length - 1}
                    onClick={() => {
                      setActiveSentFilter(filter);

                      if (filter === "all") {
                        setFilteredSentInvitations(sentInvitations);
                      }
                    }}
                    onSubvalueClick={handleSubvalueClick}
                  />
                );
              })}
            </div>
            <ul className="divide-y divide-slate-100 ">
              {filteredSentInvitations.map((invite, i) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-4 p-4 box group"
                >
                  {/* Group and Person Images */}
                  <div className=" flex items-center gap-2 min-w-0 hover:cursor-default">
                    <div className="relative flex-shrink-0 w-[88px] h-[72px]">
                      {/* Group Image */}
                      <img
                        src={invite.group.group_picture_path}
                        alt={invite.group.name}
                        className="absolute left-0 top-0
        w-16 h-16 rounded-full object-cover
        border-2 border-white shadow-md"
                      />

                      {/* Invited Person Image */}
                      <img
                        onClick={() => {
                          invite.invitee && setShowProfileModal([true, invite]);
                        }}
                        src={
                          invite.invitee?.profile_picture_path || "/guest.jpg"
                        }
                        alt={invite.invitee?.name || "Invited person"}
                        className={`absolute right-1 bottom-0
        w-10 h-10 rounded-full object-cover
        border-2 border-white shadow-md
        transition-transform duration-200 ease-in-out
        ${invite.invitee ? "group-hover:scale-105 group-hover:cursor-pointer" : ""}`}
                      />
                    </div>

                    {/* Invitation Details */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="font-semibold text-slate-700 truncate">
                        {invite.group.name}
                      </h3>

                      <p className="text-sm text-slate-500">
                        Invitation sent to
                      </p>

                      <span
                        onClick={() => {
                          invite.invitee && setShowProfileModal([true, invite]);
                        }}
                        className={`text-sm font-medium text-slate-500 truncate
        ${invite.invitee ? "group-hover:glittery-shadow hover:underline hover:cursor-pointer" : ""}
       `}
                      >
                        {invite.invitee?.name ||
                          invite.invitee_email ||
                          invite.invitee_mobile_number ||
                          "Unknown recipient"}
                      </span>
                    </div>
                  </div>

                  {/* Cancel Button */}
                  <div className="flex-shrink-0">
                    <InvitationActionButton
                      value="Cancel"
                      btnClass="reject-text reject-btn-shadow"
                      onClick={() => handleInvitationCancel(invite.id)}
                      loading={cancelLoadingId === invite.id}
                      loadingValue="Canceling..."
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
            You don't have any sent group invitations.
            <br />
            <span className="text-sm font-normal text-slate-400 italic">
              Create a group and send invitations.
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
          date={showProfileModal[1].updated_at}
          message={
            showProfileModal[1].inviter
              ? `${showProfileModal[1].inviter.name} sent you a request to join ${showProfileModal[1].group.name}`
              : `You sent a request to ${showProfileModal[1].invitee?.name} to join the group ${showProfileModal[1].group?.name}`
          }
        />
      )}
    </div>
  );
}

export default GroupInvitations;
