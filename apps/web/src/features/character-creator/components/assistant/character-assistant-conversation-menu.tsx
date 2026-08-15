import { useMemo, useState } from 'react';
import { LuCheck, LuChevronDown, LuMessageSquarePlus, LuMessagesSquare, LuTrash2 } from 'react-icons/lu';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@~/components/ui/alert-dialog';
import { Button } from '@~/components/ui/button/button';
import { Popover, PopoverContent, PopoverTrigger } from '@~/components/ui/popover';
import { cn } from '@~/lib/utils';

import type { iCharacterAssistantSession } from '../../lib/assistant/character-assistant-session';

interface iCharacterAssistantConversationMenuProps {
  activeSessionId: string;
  isDisabled: boolean;
  sessions: readonly iCharacterAssistantSession[];
  onCreate: () => Promise<unknown>;
  onDelete: (sessionId: string) => Promise<unknown>;
  onSelect: (sessionId: string) => void;
}

function getConversationTitle(session: iCharacterAssistantSession) {
  const firstUserMessage = session.messages.find((message) => message.role === 'user');
  const text = firstUserMessage?.parts
    .flatMap((part) => (part.type === 'text' && typeof part.content === 'string' ? [part.content] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'New conversation';
  return text.length > 52 ? `${text.slice(0, 49).trimEnd()}...` : text;
}

function formatConversationDate(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function CharacterAssistantConversationMenu({
  activeSessionId,
  isDisabled,
  sessions,
  onCreate,
  onDelete,
  onSelect,
}: iCharacterAssistantConversationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<iCharacterAssistantSession | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const activeTitle = activeSession ? getConversationTitle(activeSession) : 'New conversation';
  const sessionTitles = useMemo(
    () => new Map(sessions.map((session) => [session.id, getConversationTitle(session)])),
    [sessions],
  );

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-w-0 max-w-full justify-start gap-2 px-2 py-1 text-left"
            disabled={isDisabled}
            aria-label="Manage conversations"
          >
            <LuMessagesSquare className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs font-normal">{activeTitle}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{sessions.length}</span>
            <LuChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <div>
              <p className="text-sm font-medium">Conversations</p>
              <p className="text-xs text-muted-foreground">Only for this character</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                void onCreate();
              }}
            >
              <LuMessageSquarePlus className="size-4" />
              New
            </Button>
          </div>
          <div className="mt-1 max-h-72 space-y-1 overflow-y-auto" role="list" aria-label="Character conversations">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  role="listitem"
                  className={cn(
                    'group flex items-center gap-1 rounded-md border border-transparent p-1',
                    isActive && 'border-border bg-muted/60',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => {
                      onSelect(session.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {isActive ? <LuCheck className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{sessionTitles.get(session.id)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatConversationDate(session.updatedAt)} · {session.messages.length} messages
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="size-8 shrink-0 p-0 text-muted-foreground opacity-70 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Delete ${sessionTitles.get(session.id)}`}
                    onClick={() => {
                      setIsOpen(false);
                      setSessionPendingDeletion(session);
                    }}
                  >
                    <LuTrash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={sessionPendingDeletion !== null}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) setSessionPendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes its messages and assistant proposals. Your character is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (sessionPendingDeletion) void onDelete(sessionPendingDeletion.id);
                setSessionPendingDeletion(null);
              }}
            >
              Delete conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
