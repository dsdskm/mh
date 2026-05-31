import { AdminTab } from "../_lib/types";

type Props = {
  tabs: AdminTab[];
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
};

export function AdminSidebar({ tabs, activeTab, onTabChange, onLogout }: Props) {
  return (
    <aside className="h-fit rounded-3xl border border-lime-200 bg-white/95 p-4 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-700">Admin</p>
      <h1 className="mt-2 font-display text-2xl text-lime-800">운영센터</h1>
      <nav className="mt-4 space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
              activeTab === tab ? "bg-lime-600 text-white" : "bg-lime-50 text-lime-900 hover:bg-lime-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="mt-4 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700"
      >
        로그아웃
      </button>
    </aside>
  );
}
