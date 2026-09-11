"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DialogProps } from "@radix-ui/react-dialog";
import { LayoutDashboard, FolderKanban, Activity, Settings, Plus } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette({ ...props }: DialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} {...props}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push("/dashboard/projects/new"));
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Project</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push("/dashboard"));
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Overview</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push("/dashboard/projects"));
            }}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push("/dashboard/deployments"));
            }}
          >
            <Activity className="mr-2 h-4 w-4" />
            <span>Deployments</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push("/dashboard/settings"));
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
