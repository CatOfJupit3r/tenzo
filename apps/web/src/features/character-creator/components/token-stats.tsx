import { Tooltip, TooltipContent, TooltipTrigger } from '@~/components/ui/tooltip';

import type { CharacterData } from '../lib/card-schema';
import { computeCharacterTokenStats } from '../lib/token-stats';

export interface iTokenStatsProps {
  data: CharacterData;
}

export function TokenStats({ data }: iTokenStatsProps) {
  const { totalTokens, permanentTokens } = computeCharacterTokenStats(data);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="text-xs text-muted-foreground">
          {totalTokens.toLocaleString()} tokens ({permanentTokens.toLocaleString()} permanent)
        </p>
      </TooltipTrigger>
      <TooltipContent>
        Permanent tokens (name, description, personality, scenario) are sent with every message. Token counts are
        estimated and provided just for reference.
      </TooltipContent>
    </Tooltip>
  );
}
