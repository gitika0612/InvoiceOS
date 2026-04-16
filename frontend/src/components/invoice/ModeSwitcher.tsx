import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Mode = "chat" | "memory" | "template";

interface ModeSwitcherProps {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
}

const modes = [
  {
    id: "chat" as Mode,
    label: "Chat Mode",
    icon: "💬",
    description: "",
    disabled: false,
  },
  {
    id: "memory" as Mode,
    label: "Memory Mode",
    icon: "🧠",
    description: "Auto-fill from past invoices",
    disabled: true,
  },
  {
    id: "template" as Mode,
    label: "Template Mode",
    icon: "📝",
    description: "Fill a manual form",
    disabled: true,
  },
];

export function ModeSwitcher({ activeMode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {modes.map((mode) => (
          <Button
            key={mode.id}
            variant={activeMode === mode.id ? "default" : "ghost"}
            size="sm"
            disabled={mode.disabled}
            onClick={() => !mode.disabled && onModeChange(mode.id)}
            className={`
              gap-2 rounded-lg text-sm font-medium transition-all duration-200
              ${
                activeMode === mode.id
                  ? "bg-white text-gray-900 shadow-sm hover:bg-white"
                  : mode.disabled
                  ? "text-gray-400 cursor-not-allowed hover:bg-transparent"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              }
            `}
          >
            <span>{mode.icon}</span>
            <span>{mode.label}</span>
            {mode.disabled && (
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 rounded-full font-normal h-4"
              >
                Soon
              </Badge>
            )}
          </Button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 ml-1">
        {modes.find((m) => m.id === activeMode)?.description}
      </p>
    </div>
  );
}
