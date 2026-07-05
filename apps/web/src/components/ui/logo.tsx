import { cn } from '@~/lib/utils';

import { USER_THEME } from '../themes/constants';
import { useTheme } from '../themes/use-theme';

export function Logo({ className }: { className?: string }) {
  const { userTheme } = useTheme();
  return (
    <img
      src={`/favicon/favicon${userTheme === USER_THEME.light ? '.dark' : ''}.svg`}
      className={cn('size-32', className)}
      alt="startname Logo"
    />
  );
}
