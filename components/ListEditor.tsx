import { useState } from 'react';

interface Props {
  title: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}

/** 문자열 목록을 추가·삭제하는 공용 컴포넌트. 키워드와 채널 목록에 쓴다. */
export default function ListEditor({ title, placeholder, items, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    const exists = items.some((item) => item.toLowerCase() === value.toLowerCase());
    if (!exists) onChange([...items, value]);
    setDraft('');
  };

  const remove = (target: string) => onChange(items.filter((item) => item !== target));

  return (
    <section className="list-editor">
      <h2>
        {title} <span className="count">{items.length}</span>
      </h2>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
        <button type="submit" disabled={!draft.trim()}>
          추가
        </button>
      </form>

      {items.length === 0 ? (
        <p className="empty">아직 없어요.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button type="button" onClick={() => remove(item)} aria-label={`${item} 삭제`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
