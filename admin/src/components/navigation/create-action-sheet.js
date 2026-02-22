"use client";

import { Megaphone, PackagePlus, Boxes } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";

const actions = [
  {
    id: "new-product",
    label: "New Product",
    description: "Create a product with variants",
    icon: PackagePlus,
    href: "/products/new",
  },
  {
    id: "broadcast",
    label: "New Broadcast",
    description: "Send a push notification",
    icon: Megaphone,
    href: "/notifications?compose=1",
  },
  {
    id: "quick-stock",
    label: "Quick Stock Update",
    description: "Jump into inventory editor",
    icon: Boxes,
    href: "/inventory",
  },
];

export default function CreateActionSheet({ open, onClose }) {
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose} title="Create" snap="half">
      <div className="space-y-2.5 pb-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                onClose();
                router.push(action.href);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--highlight-soft)] text-[var(--highlight)]">
                <Icon size={18} />
              </span>
              <span className="block">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">{action.label}</span>
                <span className="block text-xs text-[var(--text-secondary)]">{action.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
