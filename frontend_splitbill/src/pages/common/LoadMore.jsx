export default function LoadMore({ hasMore, loading, onClick, label }) {
  if (!hasMore) return null;
  return (
    <div className="py-6 text-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="invitation-btn edit-text edit-btn-shadow disabled:opacity-60"
      >
        {loading ? "Loading..." : `Load more ${label}`}
      </button>
    </div>
  );
}
