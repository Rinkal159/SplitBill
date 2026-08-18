import React, { use, useEffect, useState } from "react";
import Navbar from "../../layout/Navbar";
import api from "../../api/axios";
import SidebarTitles from "./SidebarTitles";
import BorrowingsAndLendings from "./BorrowingsAndLendings";
import Activities from "./Activities";
import InviteFriend from "../friend/InviteFriend";
import FriendsInvitations from "../friend/FriendsInvitations";
import GroupInvitations from "../group/GroupInvitations";

function Dashboard() {
  const [dashboardData, setDashboardData] = useState({});
  const [activeSidebarTitle, setactiveSidebarTitle] = useState("Dashboard");
  const [contentRenderer, setContentRenderer] = useState("Dashboard");
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([
    "Friend invitations",
    "Group invitations",
  ]);
  const [showFriendInviteModal, setShowFriendInviteModal] = useState(false);

  // sentInvitations is here because when user invites some user, sent friend invitations should update, and the InviteFriend and FriendsInvitations common parent is Dashboard
  const [sentInvitations, setSentInvitations] = useState([]);

  const sidebarTitles = [
    "Dashboard",
    "Activities",
    "All expenses",
    "Friends",
    "Groups",
    "Invitations",
  ];

  // when user accepts friend request, getFriends() should load again
  const getFriends = async () => {
    try {
      const response = await api.get("/friends");
      setFriends(response.data);
    } catch (error) {}
  };

  // when user invites a friend, getSentFriendInvitations() should load again
  const getSentFriendInvitations = async () => {
    try {
      const response = await api.get("/friends/invitations/sent");
      console.log(response.data);

      setSentInvitations(response.data);
    } catch (error) {}
  };

  const content = {
    Dashboard: <BorrowingsAndLendings dashboardData={dashboardData} />,
    Activities: <Activities />,
    FriendInvitations: (
      <FriendsInvitations
        sentInvitations={sentInvitations}
        setSentInvitations={setSentInvitations}
        onInvitationAccepted={getFriends}
      />
    ),
    GroupInvitations: <GroupInvitations />,
  };

  useEffect(() => {
    const getDashboardData = async () => {
      try {
        const response = await api.get("/expenses/me");
        setDashboardData(response.data);
        setDashboardData((prevDashboardData) => ({
          ...prevDashboardData,
          total_balance:
            prevDashboardData.total_lendings -
            prevDashboardData.total_borrowings,
        }));
      } catch (error) {
        console.log(error);
      }
    };

    const getGroups = async () => {
      try {
        const response = await api.get("/groups");
        setGroups(response.data);
      } catch (error) {}
    };

    getDashboardData();
    getFriends();
    getGroups();
    getSentFriendInvitations();
  }, []);

  const handlePlusClick = (e, title) => {
    e.stopPropagation();

    if (title == "Friends") {
      setShowFriendInviteModal(true);
    } else {
    }
  };

  const handleSubvalueClick = (subvalue) => {
    if (subvalue === "Friend invitations") {
      setactiveSidebarTitle("Invitations");
      setContentRenderer("FriendInvitations");
    } else {
      setactiveSidebarTitle("Invitations");
      setContentRenderer("GroupInvitations");
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex justify-center w-full mx-auto gap-4 ">
        {/* left sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 h-screen shadow-xl shadow-blue-100/80 mt-4 rounded-2xl">
          {sidebarTitles.map((title) => (
            <div
              onClick={() => {
                setactiveSidebarTitle(title);
                setContentRenderer(title);
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
                        : []
                }
                plus={
                  title == "Friends" ? true : title == "Groups" ? true : false
                }
                handlePlusClick={(e) => handlePlusClick(e, title)}
                handleSubvalueClick={handleSubvalueClick}
              />
            </div>
          ))}
        </aside>

        {/* main box */}
        <main className="flex flex-col w-full max-w-2xl border border-blue-100/60 shadow-xl shadow-blue-100/80 mt-4 rounded-2xl">
          {content[contentRenderer]}
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
    </div>
  );
}

export default Dashboard;
