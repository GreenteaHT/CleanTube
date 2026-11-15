import { useEffect, useState } from 'react';

/**
 * 예시 댓글의 테마. style.css와 menu.css는 유튜브처럼 <html dark>와 .dark로 어두운 테마를 받는다.
 * 유튜브의 테마는 알 수 없어서 브라우저 테마를 따른다. <html dark>도 여기서 붙이고 뗀다.
 */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute('dark', dark);
  }, [dark]);
  return dark;
}
