import { Code, FormInput } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  activeView: 'gui' | 'source';
  onViewChange: (view: 'gui' | 'source') => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
      <button
        onClick={() => onViewChange('gui')}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-sm rounded transition-colors",
          activeView === 'gui'
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
        title="GUI Editor (Ctrl+Shift+G)"
      >
        <FormInput className="h-3.5 w-3.5" />
        <span>GUI</span>
      </button>
      <button
        onClick={() => onViewChange('source')}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-sm rounded transition-colors",
          activeView === 'source'
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
        title="Source Editor (Ctrl+Shift+S)"
      >
        <Code className="h-3.5 w-3.5" />
        <span>Source</span>
      </button>
    </div>
  );
}
