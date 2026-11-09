import React, { useEffect, useMemo, useState } from "react";
import getBackendError from "../../utils/getBackendError";
import api from "../../api/axios";
import ReceivedAndSentButton from "../friend/ReceivedAndSentButton";
import InvitationActionButton from "../friend/InvitationActionButton";
import InviterDetail from "../friend/InviterDetail";
import GroupDetails from "../group/GroupDetails";
import Filter from "../group/Filter";
import Loading from "../loading/Loading";
import Error from "../error/Error";
import formatAmount from "../../utils/formatAmount";

function CashSettlementRequests({
  sentSettlementRequests,
  setSentSettlementRequests,
  sentSettlementRequestsLoading,
}) {
  const [visible, setVisible] = useState("received");
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [backErrors, setBackErrors] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(null);

  const loadGroups = async (requests) => {
    const ids = [
      ...new Set(requests.map((request) => request.group_id).filter(Boolean)),
    ];
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await api.get(`/groups/${id}`);
          return [id, response.data.group];
        } catch {
          return [id, null];
        }
      }),
    );
    setGroups((previous) => ({ ...previous, ...Object.fromEntries(results) }));
  };

  const getReceivedRequests = async () => {
    try {
      const response = await api.get("/settlements/requests/received");
      setReceivedRequests(response.data);
      await loadGroups(response.data);
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getReceivedRequests();
  }, []);

  useEffect(() => {
    setFilteredRequests(
      visible === "received" ? receivedRequests : sentSettlementRequests,
    );
  }, [visible, receivedRequests, sentSettlementRequests]);

  const receivedPeople = useMemo(
    () => [
      ...new Map(
        receivedRequests.map((request) => [request.payer.id, request]),
      ).values(),
    ],
    [receivedRequests],
  );
  const sentPeople = useMemo(
    () => [
      ...new Map(
        sentSettlementRequests.map((request) => [request.receiver.id, request]),
      ).values(),
    ],
    [sentSettlementRequests],
  );
  const requests =
    visible === "received" ? receivedRequests : sentSettlementRequests;
  const groupOptions = [
    ...new Map(
      requests
        .filter((request) => request.group_id)
        .map((request) => [request.group_id, request]),
    ).values(),
  ];
  const peopleOptions = visible === "received" ? receivedPeople : sentPeople;

  const applyFilter = (id, kind) => {
    const filterKind =
      kind === "to_user" || kind === "from_user" ? "person" : kind;
    setActiveFilter(filterKind === "all" ? "all" : `${filterKind}:${id}`);
    const source =
      visible === "received" ? receivedRequests : sentSettlementRequests;
    setFilteredRequests(
      filterKind === "all"
        ? source
        : source.filter((request) =>
            filterKind === "person"
              ? (visible === "received"
                  ? request.payer.id
                  : request.receiver.id) === id
              : request.group_id === id,
          ),
    );
  };

  const changeTab = (tab) => {
    setVisible(tab);
    setActiveFilter("all");
    setFilteredRequests(
      tab === "received" ? receivedRequests : sentSettlementRequests,
    );
    if (tab === "sent") loadGroups(sentSettlementRequests);
  };

  const openGroup = async (groupId) => {
    try {
      const group =
        groups[groupId] || (await api.get(`/groups/${groupId}`)).data.group;
      setGroups((previous) => ({ ...previous, [groupId]: group }));
      setShowGroupModal(group);
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  const handleRequestAction = async (request, action) => {
    const id = request.id;
    setActionLoading((previous) => ({ ...previous, [id]: action }));
    setBackErrors({});
    try {
      if (action === "cancel") {
        await api.delete(`/settlements/requests/${id}`);
        setSentSettlementRequests((previous) =>
          previous.filter((item) => item.id !== id),
        );
      } else if (action === "reject") {
        await api.post(`/settlements/requests/${id}/reject`);
        setReceivedRequests((previous) =>
          previous.filter((item) => item.id !== id),
        );
      } else {
        await api.post(`/settlements/${id}`);
        setReceivedRequests((previous) =>
          previous.filter((item) => item.id !== id),
        );
      }
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setActionLoading((previous) => ({ ...previous, [id]: null }));
    }
  };

  const filters = [
    { value: "all", key: "all", subvalues: [] },
    {
      value: visible === "received" ? "from_user" : "to_user",
      key: "person",
      subvalues: peopleOptions.map((request) => ({
        id: visible === "received" ? request.payer.id : request.receiver.id,
        value:
          visible === "received" ? request.payer.name : request.receiver.name,
      })),
    },
    {
      value: "group",
      key: "group",
      subvalues: groupOptions.map((request) => ({
        id: request.group_id,
        value: groups[request.group_id]?.name || `Group ${request.group_id}`,
      })),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl glittery-shadow text-center py-4 pt-6">
        Cash Settlement Requests
      </h1>
      <div className="flex gap-3 pb-4 px-4">
        <ReceivedAndSentButton
          value="received"
          visible={visible}
          onClick={() => changeTab("received")}
        />
        <ReceivedAndSentButton
          value="sent"
          visible={visible}
          onClick={() => changeTab("sent")}
        />
      </div>
      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}

      {(visible === "received" ? loading : sentSettlementRequestsLoading) ? (
        <div className="flex justify-center">
          <Loading
            msg={`${visible} cash settlement requests`}
            padding={false}
          />
        </div>
      ) : requests.length === 0 ? (
        <h1 className="text-center text-base font-medium leading-relaxed text-slate-500">
          You don't have any pending {visible} cash settlement requests.
        </h1>
      ) : (
        <>
          <div className="px-4 pb-4 flex flex-wrap gap-y-3">
            {filters.map((filter, index) => (
              <Filter
                key={filter.key}
                value={filter.value}
                subvalues={filter.subvalues}
                isActive={
                  activeFilter === "all"
                    ? filter.key === "all"
                    : activeFilter.startsWith(`${filter.key}:`)
                }
                doApplyBorder={index !== filters.length - 1}
                onClick={() => filter.key === "all" && applyFilter(null, "all")}
                onSubvalueClick={applyFilter}
              />
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {filteredRequests.map((request) => {
              const person =
                visible === "received" ? request.payer : request.receiver;
              return (
                <li
                  key={request.id}
                  className="flex items-center justify-between p-4 box group"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      onClick={() =>
                        setShowProfileModal({
                          user: person,
                          request,
                          direction: visible,
                        })
                      }
                      className="invite-img trans hover:scale-105 hover:cursor-pointer"
                      src={person.profile_picture_path}
                      alt={person.name}
                    />
                    <div className="min-w-0 flex flex-col">
                      <button
                        onClick={() =>
                          setShowProfileModal({
                            user: person,
                            request,
                            direction: visible,
                          })
                        }
                        className="w-fit text-left text-slate-700 font-semibold group-hover:glittery-shadow hover:underline"
                      >
                        {person.name}
                      </button>
                      <p className="text-sm text-slate-500">
                        {visible === "received" ? "Requested" : "Sent"} ₹
                        {formatAmount(request.amount)}
                        {request.group_id && (
                          <>
                            {" "}
                            for{" "}
                            <button
                              className="font-medium text-slate-500 hover:underline"
                              onClick={() => openGroup(request.group_id)}
                            >
                              {groups[request.group_id]?.name ||
                                `Group ${request.group_id}`}
                            </button>
                          </>
                        )}
                        {!request.group_id && " overall"}
                      </p>
                      {request.status !== "PENDING" && (
                        <p className="text-xs text-slate-400">
                          {request.status.toLowerCase()}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {visible === "received" ? (
                          <>
                            <InvitationActionButton
                              value="Confirm"
                              btnClass="accept-text accept-btn-shadow"
                              loading={actionLoading[request.id] === "confirm"}
                              loadingValue="Confirming..."
                              onClick={() =>
                                handleRequestAction(request, "confirm")
                              }
                            />
                            <InvitationActionButton
                              value="Reject"
                              btnClass="reject-text reject-btn-shadow"
                              loading={actionLoading[request.id] === "reject"}
                              loadingValue="Rejecting..."
                              onClick={() =>
                                handleRequestAction(request, "reject")
                              }
                            />
                          </>
                        ) : (
                          <InvitationActionButton
                            value="Cancel"
                            btnClass="reject-text reject-btn-shadow"
                            loading={actionLoading[request.id] === "cancel"}
                            loadingValue="Canceling..."
                            onClick={() =>
                              handleRequestAction(request, "cancel")
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-700 group-hover:font-bold">
                    ₹{formatAmount(request.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
          {filteredRequests.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              No requests match this filter.
            </p>
          )}
        </>
      )}

      {showProfileModal && (
        <InviterDetail
          onClose={() => setShowProfileModal(null)}
          user={showProfileModal.user}
          date={showProfileModal.request.created_at}
          message={
            showProfileModal.direction === "received"
              ? "Sent you a cash settlement request"
              : "You sent a cash settlement request"
          }
        />
      )}
      {showGroupModal && (
        <GroupDetails
          onClose={() => setShowGroupModal(null)}
          group={showGroupModal}
        />
      )}
    </div>
  );
}

export default CashSettlementRequests;
