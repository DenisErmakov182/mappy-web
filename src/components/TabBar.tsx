import tabMap from "../assets/icons/tab-map.png";
import tabNotes from "../assets/icons/tab-notes.png";
import tabFriends from "../assets/icons/tab-friends.png";

export type AppTab = "map" | "notes" | "friends";

const tabs: { id: AppTab; icon: string; corners: string }[] = [
  { id: "map", icon: tabMap, corners: "rounded-l-[32px] rounded-r-[10px]" },
  { id: "notes", icon: tabNotes, corners: "rounded-[10px]" },
  { id: "friends", icon: tabFriends, corners: "rounded-r-[32px] rounded-l-[10px]" },
];

interface Props {
  selection: AppTab;
  onSelect: (tab: AppTab) => void;
}

export function TabBar({ selection, onSelect }: Props) {
  return (
    <div className="flex gap-1 p-2 bg-white rounded-[32px]">
      {tabs.map((tab) => {
        const isSelected = tab.id === selection;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex-1 flex items-center justify-center py-2 transition-colors ${tab.corners}`}
            style={{
              backgroundColor: isSelected ? "var(--mappy-brand-subtle)" : "var(--mappy-surface-secondary)",
            }}
          >
            <img
              src={tab.icon}
              alt=""
              className="h-7 w-10 object-contain transition-[filter,opacity]"
              style={
                isSelected
                  ? undefined
                  : { filter: "grayscale(1) brightness(1.05)", opacity: 0.75 }
              }
            />
          </button>
        );
      })}
    </div>
  );
}
