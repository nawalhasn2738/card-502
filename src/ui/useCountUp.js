import { useEffect, useState } from 'react';

// Animated number for score reveals. Pure display; starts after `delay` ms.
export default function useCountUp(target, { from = 0, duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let raf;
    let start;
    const timer = setTimeout(() => {
      const step = (t) => {
        if (start === undefined) start = t;
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - (1 - p) ** 3;
        setValue(Math.round(from + (target - from) * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); if (raf) cancelAnimationFrame(raf); };
  }, [target, from, duration, delay]);
  return value;
}
