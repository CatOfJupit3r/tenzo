import { LuMoon, LuSun } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@~/components/ui/dropdown-menu';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '@~/components/ui/ui-enums';

import { USER_THEME } from './themes/constants';
import { useTheme } from './themes/use-theme';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={BUTTON_VARIANTS.OUTLINE} size={BUTTON_SIZES.ICON}>
          <LuSun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <LuMoon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme(USER_THEME.LIGHT)}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(USER_THEME.DARK)}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(USER_THEME.SYSTEM)}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
