import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthProvider";
import api from "../../api/axios";
import getBackendError from "../../utils/getBackendError";
import Loading from "../loading/Loading";

function GroupDetails({ onClose, group }) {
  const { user } = useContext(AuthContext);

  const [sentInvitations, setSentInvitations] = useState([]);

  // loading
  const [loading, setLoading] = useState(true);

  // error
  const [backErrors, setBackErrors] = useState({});

  const getSentInvitations = async () => {
    try {
      const res = await api.get(`/groups/${group.id}/invitations/sent`);
      setSentInvitations(res.data.invitees);
      setLoading(false);
    } catch (error) {
      setLoading(true);
      setBackErrors(getBackendError(error));
    }
  };

  useEffect(() => {
    getSentInvitations();
  }, [group.id]);

  return (
    <div onClick={onClose} className="outer-modal">
      <div className="inner-modal px-0" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button type="button" onClick={onClose} className="cancel-icon">
          ✕
        </button>

        {/* image */}
        <div className="flex justify-center">
          <img
            src={group.group_picture_path}
            alt={group.name}
            className="mt-6 h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg"
          />
        </div>

        <h1 className="heading glittery-shadow pb-1">{group.name}</h1>
        <p className="italic-text text-center">{group?.description}</p>

        {/* group members */}
        <div className="mt-7 border-t border-sky-100 pt-5">
          <div className="mb-3 flex items-center justify-between px-6">
            <h2 className="form-lbl text-sm">Group Members</h2>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
              {group.members.length}
            </span>
          </div>

          <div className="max-h-36 space-y-3 overflow-y-auto pr-1">
            {group.members.length > 0 ? (
              group.members.map((member) => {
                const isCurrentUser = member.user.id === user.id;

                return (
                  <div
                    key={member.user.id}
                    className="flex items-center gap-2 rounded-xl box border border-sky-200/50 bg-sky-50 px-6 mx-4 py-2"
                  >
                    <img
                      className="invite-img w-12 h-12"
                      src={member.user.profile_picture_path}
                      alt={member.user.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {member.user.name}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-slate-500">
                        {member.role}
                      </p>
                    </div>
                    {isCurrentUser && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                        You
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="italic-text text-center">
                No group members currently. Send invitations to make members.
              </p>
            )}
          </div>
        </div>

        {/* pending invitations */}
        <div className="mt-5 border-t border-sky-100 pt-5">
          <div className="mb-3 flex items-center justify-between px-6">
            <h2 className="form-lbl text-sm">Pending invitations</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {sentInvitations.length}
            </span>
          </div>

          {Object.keys(backErrors).length !== 0 && (
            <Error errors={backErrors.error} type={backErrors.type} />
          )}

          <div className="max-h-28 space-y-3 overflow-y-auto px-4">
            {loading ? (
              <div className="flex justify-center items-center pb-4">
                <Loading msg={"Pending group invitations"} />
              </div>
            ) : sentInvitations.length > 0 ? (
              sentInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 pending-box"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                    <i
                      className="fa-regular fa-paper-plane"
                      aria-hidden="true"
                    />
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-slate-700">
                    {invitation.invitee?.name ||
                      invitation.invitee_email ||
                      invitation.invitee_mobile_number ||
                      "Unknown recipient"}
                  </p>
                </div>
              ))
            ) : (
              <p className="italic-text text-center">No pending invitations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupDetails;
