import ListEditor from '@/components/ListEditor';
import { useSettings } from '@/hooks/useSettings';
import './App.css';

/** 툴바 아이콘을 눌렀을 때 뜨는 팝업. 지금은 차단 작성자 목록 편집이 전부다. */
export default function App() {
  const { settings, update } = useSettings();

  if (!settings) return <div className="popup muted">불러오는 중…</div>;

  return (
    <div className="popup">
      <h1>CleanTube</h1>

      <ListEditor
        title="숨길 댓글 작성자"
        placeholder="@핸들 또는 채널명 (정확히 일치)"
        items={settings.blockedAuthors}
        onChange={(blockedAuthors) => update({ blockedAuthors })}
      />

      <p className="muted">목록을 바꾸면 열려 있는 유튜브 탭에 바로 반영돼요.</p>
    </div>
  );
}
