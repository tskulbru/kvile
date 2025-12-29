import { useAppStore } from "@/stores/appStore";

export function UnsavedChangesDialog() {
  const { openFiles, pendingCloseIndex, setPendingCloseIndex, confirmCloseFile } =
    useAppStore();

  if (pendingCloseIndex === null) return null;

  const file = openFiles[pendingCloseIndex];
  if (!file) return null;

  const handleSave = () => {
    confirmCloseFile(true);
  };

  const handleDiscard = () => {
    confirmCloseFile(false);
  };

  const handleCancel = () => {
    setPendingCloseIndex(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-xl max-w-md border border-border">
        <h2 className="text-lg font-semibold mb-2">Unsaved Changes</h2>
        <p className="text-muted-foreground mb-4">
          Do you want to save the changes you made to{" "}
          <span className="font-medium text-foreground">{file.name}</span>?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 hover:bg-accent rounded-md transition-colors"
          >
            Don&apos;t Save
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 hover:bg-accent rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
