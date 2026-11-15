import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider } from '@/hooks/useI18n';
import App from './App.tsx';
import '@/assets/base.css';
// 예시 댓글이 유튜브에서와 똑같이 보이게 콘텐츠 스크립트의 가림막·메뉴 버튼 모양과 댓글 메뉴 모양을 그대로 가져온다.
// base.css 뒤에 와야 한다. 같은 무게의 규칙(버튼 hover 등)은 뒤에 온 것이 이긴다.
import '@/entrypoints/youtube.content/style.css';
import '@/entrypoints/youtube.content/menu.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
