import { useEffect, useState } from "react";
import Navbar from "../../layout/Navbar";
import api from "../../api/axios";
import SidebarTitles from "./SidebarTitles";
import BorrowingsAndLendings from "./BorrowingsAndLendings";
import Activities from "../activities/Activities";
import InviteFriend from "../friend/InviteFriend";
import FriendsInvitations from "../friend/FriendsInvitations";
import GroupInvitations from "../group/GroupInvitations";
import AllExpenses from "../expense/AllExpenses";
import FriendExpenses from "../friend/FriendExpenses";
import Friends from "../friend/Friends";
import GroupCreate from "../group/GroupCreate";
import Invitations from "../invitations/Invitations";
import GroupExpenses from "../group/GroupExpenses";
import Loading from "../loading/Loading";
import Error from "../error/Error";
import getBackendError from "../../utils/getBackendError";
import CashSettlementRequests from "../settlement/CashSettlementRequests";
import SettlementHistory from "../settlement/SettlementHistory";

function Dashboard() {
  const [dashboardData, setDashboardData] = useState({});
  const [activeSidebarTitle, setactiveSidebarTitle] = useState("Dashboard");
  const [contentRenderer, setContentRenderer] = useState("Dashboard");
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const invitations = ["Friend invitations", "Group invitations"];
  const settlements = ["Cash Settlement Requests", "Settlement History"];

  const [showFriendInviteModal, setShowFriendInviteModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // sentInvitations is here because when user invites some user, sent friend invitations should update, and the InviteFriend and FriendsInvitations common parent is Dashboard
  const [sentInvitations, setSentInvitations] = useState([]);

  // sentGroupInvitations is here
  const [sentGroupInvitations, setSentGroupInvitations] = useState([]);

  // sentSettlementRequests is here
  const [sentSettlementRequests, setSentSettlementRequests] = useState([]);

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // loading and error
  const [loading, setLoading] = useState({
    dashboard: true,
    friends: true,
    groups: true,
    sentFriendInvitations: true,
    sentGroupInvitations: true,
    sentSettlementRequests: true,
  });
  const [backErrors, setBackErrors] = useState({});

  const sidebarTitles = [
    "Dashboard",
    "Activities",
    "All Expenses",
    "Friends",
    "Groups",
    "Invitations",
    "Settlements",
  ];

  const getDashboardData = async () => {
    try {
      const response = await api.get("/expenses/me");
      const data = response.data;

      setDashboardData({
        ...data,
        total_balance: data.total_lendings - data.total_borrowings,
      });

      setLoading((prevLoading) => ({
        ...prevLoading,
        dashboard: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading((prevLoading) => ({ ...prevLoading, dashboard: false }));
    }
  };

  const getGroups = async () => {
    try {
      const response = await api.get("/groups");
      setGroups(response.data);

      setLoading((prevLoading) => ({
        ...prevLoading,
        groups: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading((prevLoading) => ({ ...prevLoading, groups: false }));
    }
  };

  // when user accepts friend request, getFriends() should load again
  const getFriends = async () => {
    try {
      const response = await api.get("/friends");
      setFriends(response.data);

      setLoading((prevLoading) => ({
        ...prevLoading,
        friends: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading((prevLoading) => ({ ...prevLoading, friends: false }));
    }
  };

  // when user invites a friend, getSentFriendInvitations() should load again
  const getSentFriendInvitations = async () => {
    try {
      const response = await api.get("/friends/invitations/sent/page", {
        params: { page: 1, limit: 10 },
      });
      setSentInvitations(response.data.items);

      setLoading((prevLoading) => ({
        ...prevLoading,
        sentFriendInvitations: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading((prevLoading) => ({
        ...prevLoading,
        sentFriendInvitations: false,
      }));
    }
  };

  // when user creates a group and sent invitations initially, it should load again
  const getSentGroupInvitations = async () => {
    try {
      const response = await api.get("/groups/invitations/sent/page", {
        params: { page: 1, limit: 10 },
      });
      setSentGroupInvitations(response.data.items);

      setLoading((prevLoading) => ({
        ...prevLoading,
        sentGroupInvitations: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading((prevLoading) => ({
        ...prevLoading,
        sentGroupInvitations: false,
      }));
    }
  };

  const getSentSettlementRequests = async () => {
    try {
      const res = await api.get("/settlements/requests/sent/page", {
        params: { page: 1, limit: 10 },
      });
      setSentSettlementRequests(res.data.items);
      setLoading((prevLoading) => ({
        ...prevLoading,
        sentSettlementRequests: false,
      }));
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  const loadDashboardBootstrap = async () => {
    try {
      const response = await api.get("/dashboard");
      const data = response.data;

      setDashboardData({
        ...data.dashboard,
        total_balance:
          data.dashboard.total_lendings - data.dashboard.total_borrowings,
      });
      setFriends(data.friends);
      setGroups(data.groups);
      setSentInvitations([]);
      setSentGroupInvitations([]);
      setSentSettlementRequests([]);
      setLoading({
        dashboard: false,
        friends: false,
        groups: false,
        sentFriendInvitations: false,
        sentGroupInvitations: false,
        sentSettlementRequests: false,
      });
    } catch (error) {
      setBackErrors(getBackendError(error));
      setLoading({
        dashboard: false,
        friends: false,
        groups: false,
        sentFriendInvitations: false,
        sentGroupInvitations: false,
        sentSettlementRequests: false,
      });
    }
  };

  useEffect(() => {
    loadDashboardBootstrap();
  }, []);

  const [activeSubvalue, setActiveSubValue] = useState(null);

  const onFriendClickEvent = (friend) => {
    setSelectedFriend(friend);
    setActiveSubValue(friend.id);
    setactiveSidebarTitle("Friends");
    setContentRenderer("FriendExpenses");
  };

  const onGroupClickEvent = (group) => {
    setSelectedGroup(group.group);
    setActiveSubValue(group.group.id);
    setactiveSidebarTitle("Groups");
    setContentRenderer("GroupExpenses");
  };

  const handlePlusClick = (e, title) => {
    e.stopPropagation();

    if (title == "Friends") {
      setShowFriendInviteModal(true);
    } else if (title == "Groups") {
      setShowCreateGroupModal(true);
    }
  };

  const handleSubvalueClick = (subvalue) => {
    setActiveSubValue(subvalue);

    if (subvalue === "Friend invitations") {
      setactiveSidebarTitle("Invitations");
      setContentRenderer("FriendInvitations");
    } else if (subvalue === "Group invitations") {
      setactiveSidebarTitle("Invitations");
      setContentRenderer("GroupInvitations");
    } else if (subvalue == "Cash Settlement Requests") {
      setactiveSidebarTitle("Settlements");
      setContentRenderer("CashSettlementRequests");
    } else if (subvalue == "Settlement History") {
      setactiveSidebarTitle("Settlements");
      setContentRenderer("SettlementHistory");
    } else {
      if (subvalue.email) {
        onFriendClickEvent(subvalue);
      } else if (subvalue.group) {
        onGroupClickEvent(subvalue);
      }
    }
  };

  const renderContent = () => {
    switch (contentRenderer) {
      case "Dashboard":
        return (
          <BorrowingsAndLendings
            dashboardData={dashboardData}
            onUserClick={onFriendClickEvent}
          />
        );
      case "Activities":
        return <Activities setBackErrors={setBackErrors} />;
      case "FriendInvitations":
        return (
          <FriendsInvitations
            sentInvitations={sentInvitations}
            setSentInvitations={setSentInvitations}
            onInvitationAccepted={getFriends}
            sentFriendInvitationsLoading={loading.sentFriendInvitations}
          />
        );
      case "GroupInvitations":
        return (
          <GroupInvitations
            sentInvitations={sentGroupInvitations}
            setSentInvitations={setSentGroupInvitations}
            onInvitationAccepted={getGroups}
            sentGroupInvitationsLoading={loading.sentGroupInvitations}
          />
        );
      case "AllExpenses":
        return (
          <AllExpenses
            loadSentSettlementReuqests={getSentSettlementRequests}
            loadDashboardData={getDashboardData}
          />
        );
      case "Friends":
        return (
          <Friends
            onClickEvent={onFriendClickEvent}
            onPlusClickEvent={handlePlusClick}
          />
        );
      case "Invitations":
        return (
          <Invitations
            setContentRenderer={setContentRenderer}
            setActiveSubvalue={setActiveSubValue}
          />
        );
      case "FriendExpenses":
        return (
          <FriendExpenses
            key={`friend-${selectedFriend?.id}`}
            friend={selectedFriend}
            isGroupOnlySettlement={
              !friends.some((friend) => friend.id === selectedFriend?.id)
            }
            loadSentSettlementReuqests={getSentSettlementRequests}
            loadDashboardData={getDashboardData}
          />
        );
      case "GroupExpenses":
        return (
          <GroupExpenses
            key={`group-${selectedGroup?.id}`}
            receivedGroup={selectedGroup}
            onInvitationSent={getSentFriendInvitations}
            getGroups={getGroups}
            loadSentSettlementReuqests={getSentSettlementRequests}
            loadDashboardData={getDashboardData}
          />
        );
      case "CashSettlementRequests":
        return (
          <CashSettlementRequests
            sentSettlementRequests={sentSettlementRequests}
            setSentSettlementRequests={setSentSettlementRequests}
            sentSettlementRequestsLoading={loading.sentSettlementRequests}
          />
        );
      case "SettlementHistory":
        return <SettlementHistory />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar
        dashboardBorrowings={dashboardData.borrowings ?? []}
        dashboardFriends={friends}
        loadSentSettlementReuqests={getSentSettlementRequests}
        loadDashboardData={getDashboardData}
      />

      {Object.keys(backErrors).length !== 0 && (
        <Error
          errors={backErrors?.error}
          type={backErrors?.type}
          shouldRoundAllCorners={false}
        />
      )}

      <div className="flex justify-center w-full mx-auto gap-4 ">
        {/* left sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 h-screen shadow-xl shadow-blue-100/80 mt-4 rounded-2xl">
          {sidebarTitles.map((title) => (
            <div
              onClick={() => {
                setactiveSidebarTitle(title);
                const titleWithoutSpaces = title.replace(/\s/g, "");
                setContentRenderer(titleWithoutSpaces);
              }}
            >
              <SidebarTitles
                value={title}
                isActive={activeSidebarTitle === title}
                subValues={
                  title == "Friends"
                    ? friends
                    : title == "Groups"
                      ? groups
                      : title == "Invitations"
                        ? invitations
                        : title == "Settlements"
                          ? settlements
                          : []
                }
                isLoading={
                  title == "Friends"
                    ? loading.friends
                    : title == "Groups"
                      ? loading.groups
                      : false
                }
                isGroup={title == "Groups" ? true : false}
                plus={
                  title == "Friends" ? true : title == "Groups" ? true : false
                }
                handlePlusClick={(e) => handlePlusClick(e, title)}
                handleSubvalueClick={handleSubvalueClick}
                activeSubvalue={activeSubvalue}
              />
            </div>
          ))}
        </aside>

        {/* main box */}
        <main className="flex flex-col w-full max-w-2xl border border-blue-100/60 shadow-xl shadow-blue-100/80 mt-4 rounded-2xl">
          {loading.dashboard && contentRenderer === "Dashboard" ? (
            <Loading msg={"Dashboard"} />
          ) : (
            renderContent()
          )}
        </main>

        {/* right sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 h-screen"></aside>
      </div>

      {showFriendInviteModal && (
        <InviteFriend
          onInvitationSent={getSentFriendInvitations}
          onClose={() => setShowFriendInviteModal(false)}
        />
      )}

      {showCreateGroupModal && (
        <GroupCreate
          onClose={() => setShowCreateGroupModal(false)}
          onInvitationSent={getSentGroupInvitations}
          getGroups={getGroups}
        />
      )}
    </div>
  );
}

export default Dashboard;
