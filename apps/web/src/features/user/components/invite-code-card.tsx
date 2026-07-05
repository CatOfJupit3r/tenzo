import { useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';

import { CopyButton } from '@~/components/copy-button';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@~/components/ui/dialog';

import { useRegeneratePublicCode } from '../hooks/use-regenerate-invite-code';

interface iPublicCodeCardProps {
  publicCode: string;
}

export function PublicCodeCard({ publicCode }: iPublicCodeCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { regeneratePublicCode, isPending } = useRegeneratePublicCode();

  const handleRegenerateClick = () => {
    setIsDialogOpen(true);
  };

  const handleConfirmRegenerate = () => {
    regeneratePublicCode({});
    setIsDialogOpen(false);
  };

  const handleCancelRegenerate = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Invite Code</CardTitle>
          <CardDescription>Share this code with others so they can invite you to private challenges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md bg-muted px-4 py-3 font-mono text-lg font-semibold tracking-wider">
              {publicCode}
            </div>
            <CopyButton
              value={publicCode}
              successMessage="Invite code copied to clipboard"
              disabled={isPending}
              aria-label="Copy invite code"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRegenerateClick} disabled={isPending} className="gap-2">
            <LuRefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Regenerate Code
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogTitle>Regenerate Invite Code</DialogTitle>
          <DialogDescription>
            Are you sure you want to regenerate your invite code? The old code will no longer work and anyone with the
            old code will not be able to invite you to private challenges.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" onClick={handleCancelRegenerate} disabled={isPending} variant="outline">
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmRegenerate} disabled={isPending} variant="destructive">
              {isPending ? 'Regenerating...' : 'Regenerate Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
