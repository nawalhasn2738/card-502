import { useCallback, useRef } from 'react';
import { View } from 'react-native';

// Records the on-screen centre of a view under `id` in a shared registry so
// card animations know where seats, piles and the hand are.
export default function Anchor({ id, registry, style, children, pointerEvents }) {
  const ref = useRef(null);
  const measure = useCallback(() => {
    // Measure after layout settles; measureInWindow gives screen coordinates.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow?.((x, y, w, h) => {
        if (Number.isFinite(x) && Number.isFinite(y)) registry.current[id] = { x: x + w / 2, y: y + h / 2, w, h };
      });
    });
  }, [id, registry]);
  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style} pointerEvents={pointerEvents}>
      {children}
    </View>
  );
}
