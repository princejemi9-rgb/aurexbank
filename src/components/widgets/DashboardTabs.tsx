"use client";

interface Props {
  active: string;
  setActive: (
    value: string
  ) => void;
}

export default function DashboardTabs({
  active,
  setActive,
}: Props) {

  const tabs = [
    "Overview",
    "Cards",
    "Transfers",
    "Analytics",
  ];

  return (
    <div className="flex gap-3 overflow-x-auto mb-6 scrollbar-hide">

      {tabs.map((tab) => (

        <button
          key={tab}
          onClick={() =>
            setActive(tab)
          }
          className={`px-5 py-3 rounded-2xl whitespace-nowrap font-bold transition ${
            active === tab
              ? "bg-green-500 text-black"
              : "bg-white/5 border border-white/10"
          }`}
        >

          {tab}

        </button>

      ))}

    </div>
  );
}