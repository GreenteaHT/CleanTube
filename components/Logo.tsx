/** 말풍선 안의 한 줄을 막대로 지운 모양. 툴바 아이콘(assets/icon/)과 같은 그림이다. 글자색을 따라간다. */
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 3.5h15v10h-8l-4 3v-3h-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="6" y="7.6" width="8" height="1.8" fill="currentColor" />
    </svg>
  );
}
