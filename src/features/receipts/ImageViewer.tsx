import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useReceiptImage } from "./api";

/** Celá fotka dokladu na čiernom pozadí. Priblížiš ju dvoma prstami a posúvaš ju ťahaním. */
export function ImageViewer({ path, onClose }: { path: string | null; onClose: () => void }) {
  const image = useReceiptImage(path ?? undefined);
  useEffect(() => {
    if (!path) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [path, onClose]);
  if (!path) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Fotka dokladu" className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex justify-end p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <IconButton label="Zavrieť" onClick={onClose} className="text-white active:bg-white/15">
          <X className="size-6" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-safe" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        {image.data ? (
          <img src={image.data} alt="Fotka dokladu" className="mx-auto w-full max-w-3xl" />
        ) : (
          <div className="flex justify-center py-20 text-white/70">
            {image.isError ? "Fotku sa nepodarilo načítať." : <Loader2 className="size-6 animate-spin" aria-label="Načítavam" />}
          </div>
        )}
      </div>
    </div>
  );
}
