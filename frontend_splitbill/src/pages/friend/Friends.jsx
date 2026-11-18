import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import FriendHeader from "./FriendHeader";
import Loading from "../loading/Loading";
import getBackendError from "../../utils/getBackendError";
import LoadMore from "../common/LoadMore";

const PAGE_SIZE = 10;

function Friends({ onClickEvent, onPlusClickEvent }) {
  const [friendExpenses, setFriendExpenses] = useState([]);

  // loading
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // error
  const [backErrors, setBackErrors] = useState({});

  const getTotalBalancesWithFriends = async (nextPage = 1, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const res = await api.get("/expenses/friends/balances/all", { params: { page: nextPage, limit: PAGE_SIZE } });
      setFriendExpenses((previous) => append ? [...previous, ...res.data.items] : res.data.items);
      setPage(res.data.page);
      setHasMore(res.data.has_more);
    } catch (error) {
      setBackErrors(getBackendError(error));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    getTotalBalancesWithFriends();
  }, []);

  if (loading) {
    return <Loading msg={"Friends"} />;
  }

  return (
    <div>
      {Object.keys(backErrors).length !== 0 && (
        <Error errors={backErrors.error} type={backErrors.type} />
      )}
      <div className="flex justify-between px-6 items-center">
        <h1 className="heading glittery-shadow py-6">Friends</h1>
        <button
          onClick={(e) => onPlusClickEvent(e, "Friends")}
          className="invitation-btn edit-text edit-btn-shadow py-2 px-4"
        >
          Add friend <span className="font-bold">+</span>{" "}
        </button>
      </div>
      <ul>
        {friendExpenses.map((friend) => (
          <div key={friend.friend.id}>
            <FriendHeader friendExpenses={friend} onClickEvent={onClickEvent} />
          </div>
        ))}
      </ul>
      <LoadMore hasMore={hasMore} loading={loadingMore} label="friends" onClick={() => getTotalBalancesWithFriends(page + 1, true)} />
    </div>
  );
}

export default Friends;
