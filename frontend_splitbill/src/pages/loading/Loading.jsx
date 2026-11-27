import React from "react";

function Loading({ msg, sidebar = false, padding = true, custom = false }) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-1 ${sidebar || !padding ? `pt-0` : `pt-6`}`}
    >
      <span
        className={`inline-block animate-pulse glittery-shadow leading-none ${sidebar && `text-sm opacity-70`} ${custom && `text-white text-xl font-bold`}`}
      >
        {msg}
      </span>
      <span
        className={`loading loading-bars loading-xs ${custom ? `text-white` : `text-sky-500`} slow-loading ${sidebar && `opacity-70`}`}
      />
    </div>
  );
}

export default Loading;
