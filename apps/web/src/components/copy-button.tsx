import { useCopyToClipboard } from '@uidotdev/usehooks';
import { useEffect, useState } from 'react';
import { LuCheck, LuCopy } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';

import { toastError, toastSuccess } from './toastifications';

interface iCopyButtonProps {
  value: string;
  successMessage?: string;
  errorMessage?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function CopyButton({
  value,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy',
  disabled = false,
  'aria-label': ariaLabel = 'Copy to clipboard',
}: iCopyButtonProps) {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);

  const isCopied = copiedText === value && isShowingFeedback;

  const handleCopy = async () => {
    try {
      await copyToClipboard(value);
      setIsShowingFeedback(true);
      toastSuccess(successMessage);
    } catch {
      toastError(errorMessage);
    }
  };

  useEffect(() => {
    if (isShowingFeedback) {
      const timer = setTimeout(() => {
        setIsShowingFeedback(false);
      }, 2000);

      return () => {
        clearTimeout(timer);
      };
    }

    return undefined;
  }, [isShowingFeedback]);

  return (
    <Button variant="outline" size="icon" onClick={handleCopy} disabled={disabled} aria-label={ariaLabel}>
      {isCopied ? <LuCheck className="size-4" /> : <LuCopy className="size-4" />}
    </Button>
  );
}
