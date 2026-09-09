import { LuTrash2 } from 'react-icons/lu';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@~/components/ui/alert-dialog';
import { Button } from '@~/components/ui/button/button';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '@~/components/ui/ui-enums';

export interface iCharacterDeleteDialogProps {
  displayName: string;
  onRemove: () => Promise<unknown>;
  className?: string;
}

export function CharacterDeleteDialog({ displayName, onRemove, className }: iCharacterDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={BUTTON_SIZES.ICON}
          variant={BUTTON_VARIANTS.GHOST}
          className={className}
          aria-label={`Delete ${displayName}`}
          title="Delete"
        >
          <LuTrash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the character, portrait, and assistant conversation stored in this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
