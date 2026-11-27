import React, { useEffect, useRef, useState } from "react";
import LoginAndSignup from "../pages/index/LoginAndSignup";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, CircleUserRound, LogOut, Settings } from "lucide-react";
import Loading from "../pages/loading/Loading";
import api from "../api/axios";
import SelectMenu from "../pages/expense/SelectMenu";
import FriendSettlement from "../pages/settlement/FriendSettlement";
import getBackendError from "../utils/getBackendError";
import Error from "../pages/error/Error";
import formatAmount from "../utils/formatAmount";
import Logo from "./Logo";

function Navbar({
  dashboardBorrowings,
  dashboardFriends,
  loadSentSettlementReuqests,
  loadDashboardData,
}) {
  const { user, loading } = useContext(AuthContext);
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const profileMenuRef = useRef(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [availableBorrowings, setAvailableBorrowings] = useState([]);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [loadingBorrowings, setLoadingBorrowings] = useState(false);
  const settlementUsers = (dashboardBorrowings ?? availableBorrowings).map(
    ({ borrowed_from, amount }) => ({
      user: borrowed_from,
      debtAmount: Number(amount),
    }),
  );
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [groupDebts, setGroupDebts] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState({});

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      )
        setProfileMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setShowLogoutConfirm(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const confirmLogout = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await api.get("/auth/logout");
      setUser(null);
      setShowLogoutConfirm(false);
      navigate("/login");
    } catch (error) {
      setLogoutError(
        getBackendError(error).error?.[0] ??
          "Could not log out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const openSettleModal = async () => {
    setShowSettleModal(true);
    setModalError({});
    if (dashboardBorrowings !== undefined) return;
    setLoadingBorrowings(true);
    try {
      const [dashboardResponse, friendsResponse] = await Promise.all([
        api.get("/expenses/me"),
        api.get("/friends"),
      ]);
      setAvailableBorrowings(dashboardResponse.data.borrowings ?? []);
      setAvailableFriends(friendsResponse.data ?? []);
    } catch (error) {
      setModalError(getBackendError(error));
    } finally {
      setLoadingBorrowings(false);
    }
  };

  const chooseFriend = async (friend) => {
    setSelectedFriend(friend);
    setFriendData(null);
    setGroupDebts([]);
    if (!friend) return;
    setModalLoading(true);
    setModalError({});
    try {
      const [expensesResponse, groupsResponse] = await Promise.all([
        api.get(`/expenses/friends/${friend.id}`),
        api.get(`/expenses/groups/debt/${friend.id}`),
      ]);
      setFriendData(expensesResponse.data);
      setGroupDebts(groupsResponse.data);
    } catch (error) {
      setModalError(getBackendError(error));
    } finally {
      setModalLoading(false);
    }
  };

  const closeSettleModal = () => {
    setShowSettleModal(false);
    setSelectedFriend(null);
    setFriendData(null);
  };
  const hasDebtToSettle = Boolean(
    friendData &&
    (Number(friendData.total_balance) < 0 ||
      Number(friendData.individual_balance) < 0 ||
      groupDebts.some((item) => Number(item.debt_amount) > 0)),
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center">
        <Loading msg={"Loading"} />
      </div>
    );
  }

  return user ? (
    <div className="w-full shadow-lg shadow-sky-50">
      <div className="relative max-w-6xl mx-auto py-4 px-10 lg:px-0 flex justify-between items-center flex-wrap gap-3">
        <Logo />

        <div className="grid auto-cols-max grid-flow-col items-center gap-3">
          <Link
            to="/expenses/add"
            className="btn invitation-btn !mt-0 edit-text edit-btn-shadow px-4"
          >
            Add Expense
          </Link>
          <button
            onClick={openSettleModal}
            className="btn !mt-0 invitation-btn edit-text edit-btn-shadow px-4"
          >
            Settle up
          </button>
          <div className="relative ml-2" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label="Open profile menu"
              aria-expanded={profileMenuOpen}
              className="flex items-center gap-1 rounded-full p-1.5 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <img
                className="w-11 h-11 rounded-full object-cover border border-white shadow-md shadow-sky-100"
                src={user.profile_picture_path}
                alt="Profile"
              />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-200/70">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="truncate font-semibold glittery-shadow">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {user.email}
                  </p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50"
                >
                  <CircleUserRound size={17} fontWeight={600} /> My profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-sky-50 font-medium"
                >
                  <Settings size={17} /> Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setLogoutError("");
                    setShowLogoutConfirm(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 font-medium"
                >
                  <LogOut size={17} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* settle up */}
      {showSettleModal &&
        (selectedFriend && friendData && hasDebtToSettle ? (
          <FriendSettlement
            onClose={closeSettleModal}
            toUser={selectedFriend}
            settlementValue={formatAmount(
              Math.abs(Number(friendData.total_balance)),
            )}
            overallValue={friendData.total_balance}
            individualValue={friendData.individual_balance}
            loadFriendExpenses={() =>
              api.get(`/expenses/friends/${selectedFriend.id}`)
            }
            setFriendExpensesLoading={() => {}}
            loadSentSettlementReuqests={
              loadSentSettlementReuqests ??
              (() => api.get("/settlements/requests/sent"))
            }
            activeFilter="all"
            settlementGroups={groupDebts}
            settlementGroupsLoading={false}
            loadDashboardData={
              loadDashboardData ?? (() => api.get("/expenses/me"))
            }
            isGroupOnlySettlement={
              !(dashboardFriends ?? availableFriends).some(
                (friend) => friend.id === selectedFriend.id,
              )
            }
          />
        ) : (
          <div className="outer-modal">
            <div
              className="inner-modal max-w-md p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeSettleModal}
                aria-label="Close expense summary"
                className="cancel-icon top-2 right-2"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
              {loadingBorrowings ? (
                <div className="flex justify-center">
                  <Loading msg="Loading outstanding balances" />
                </div>
              ) : settlementUsers.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  You have no outstanding borrowings to settle.
                </p>
              ) : (
                <>
                  <SelectMenu
                    options={settlementUsers.map(
                      ({ user: person, debtAmount }) => ({
                        value: person.id,
                        label: person.name,
                        friend: person,
                        debtAmount,
                      }),
                    )}
                    value={
                      selectedFriend
                        ? {
                            value: selectedFriend.id,
                            label: selectedFriend.name,
                            friend: selectedFriend,
                            debtAmount: settlementUsers.find(
                              ({ user: person }) =>
                                person.id === selectedFriend.id,
                            )?.debtAmount,
                          }
                        : null
                    }
                    onChange={(option) => chooseFriend(option?.friend ?? null)}
                    field="navbar-settlement-friend"
                    label="Who do you want to settle with?"
                    placeholder="Search and choose a person you owe"
                    autoFocus
                    defaultMenuIsOpen
                    isMultiSelect={false}
                    closeMenuOnSelect
                    required
                    formatOptionLabel={(option) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span>{option.label}</span>
                        <span className="font-medium reject-text">
                          ₹{formatAmount(option.debtAmount)}
                        </span>
                      </div>
                    )}
                  />
                  {Object.keys(modalError).length > 0 && (
                    <Error errors={modalError.error} type={modalError.type} />
                  )}
                  {modalLoading && (
                    <div className="flex justify-center items-center">
                      <Loading msg="Loading settlements" />
                    </div>
                  )}
                  {selectedFriend &&
                    friendData &&
                    Number(friendData.total_balance) >= 0 && (
                      <p className="py-4 text-center text-sm text-slate-500">
                        You don’t owe {selectedFriend.name} anything to settle.
                      </p>
                    )}
                </>
              )}
            </div>
          </div>
        ))}

      {/* logout */}
      {showLogoutConfirm && (
        <div
          className="outer-modal"
          onClick={() => !loggingOut && setShowLogoutConfirm(false)}
        >
          <div
            className="inner-modal max-w-sm p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <LogOut size={21} />
            </div>
            <h2 id="logout-title" className="text-xl font-semibold reject-text">
              Log out of SplitBill?
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              You’ll need to sign in again to access your account.
            </p>
            {logoutError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {logoutError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="slate-text slate-btn-shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={confirmLogout}
                className="rounded-xl border border-red-400 bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-border text-white shadow-sm shadow-rose-200/50 px-4 py-2 text-sm font-medium  disabled:opacity-60 hover:-translate-y-0.5 trans hover:shadow-md hover:shadow-rose-200"
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="max-w-6xl mx-auto py-6 px-10 lg:px-0 flex justify-between items-center flex-wrap gap-3">
      <Logo />
      <div className="flex gap-4 items-center">
        <LoginAndSignup value={"Login"} to={"/login"} />
        <div className="h-5 w-px hidden bg-slate-200 sm:block" />
        <LoginAndSignup value={"Signup"} to={"/signup"} />
      </div>
    </div>
  );
}

export default Navbar;
