import React from "react";

function InviteSection({heading, desc, contentRenderer, setContentRenderer, setActiveSubvalue}) {
  return (
    <section
      className="box p-4 px-6 group hover:cursor-pointer"
      onClick={() => {
        setContentRenderer(contentRenderer);
        setActiveSubvalue(heading);
      }}
    >
      <h2 className="text-lg glittery-shadow font-semibold group-hover:translate-x-0.5 transition-all duration-200 ease-out">
        {heading} <i class="fa-solid fa-arrow-right-long"></i>
      </h2>
      <p className="mt-1 text-sm text-slate-500 font-semibold group-hover:translate-x-0.5 transition-all duration-200 ease-out">
        {desc}
      </p>
    </section>
  );
}

export default InviteSection;
