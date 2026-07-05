import { useEffectEvent, useEffect } from 'react';

export default function useOnKeyPress(targetKey: string, cb: (event: KeyboardEvent) => unknown) {
  const onPress = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== targetKey) return;

    cb(event);
  });

  useEffect(() => {
    window.addEventListener('keydown', onPress);

    return () => {
      window.removeEventListener('keydown', onPress);
    };
  }, []);
}
