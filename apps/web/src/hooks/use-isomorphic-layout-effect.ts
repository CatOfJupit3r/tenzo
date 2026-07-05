import { useLayoutEffect } from '@tanstack/react-router';
import { useEffect } from 'react';

import { isOnClient } from '@~/utils/ssr-helpers';

export const useIsomorphicLayoutEffect = isOnClient ? useLayoutEffect : useEffect;
