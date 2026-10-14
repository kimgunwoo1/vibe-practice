# vibe-practice

HTML 파일 하나로 만든 작은 웹페이지 연습 모음입니다. 설치할 것 없이 브라우저만 있으면 바로 실행됩니다.

## 바로 해보기

| 페이지 | 주소 |
|---|---|
| 📝 할 일 목록 | https://kimgunwoo1.github.io/vibe-practice/ |
| 🎮 가위바위보 | https://kimgunwoo1.github.io/vibe-practice/rps.html |

두 페이지는 카드 아래 링크로 서로 오갈 수 있습니다.

## 📝 할 일 목록 (`index.html`)

- 할 일 추가 (입력 후 Enter 또는 "추가" 버튼)
- 체크박스로 완료 표시, `×` 버튼으로 삭제
- 전체 / 진행 중 / 완료 필터
- 남은 할 일 개수 표시, 완료 항목 한 번에 삭제
- 새로고침해도 목록 유지

## 🎮 가위바위보 (`rps.html`)

- 버튼 또는 키보드 `1` 가위 / `2` 바위 / `3` 보
- 승·패·무, 연승, 최고 연승, 최근 10판 기록
- 승리·패배·무승부마다 다른 효과음 (🔊 버튼으로 끄고 켜기)
- 새로고침해도 점수 유지, "점수 초기화"는 두 번 눌러야 확정

## 공통

- 파스텔 디자인과 🌙/☀️ 다크 모드 버튼 (두 페이지가 설정을 공유)
- 휴대폰 화면에서도 사용 가능

## 내 컴퓨터에서 실행하기

```bash
git clone https://github.com/kimgunwoo1/vibe-practice.git
cd vibe-practice
open index.html
```

macOS가 아니라면 `index.html` 파일을 더블클릭해서 브라우저로 여세요.

## 사용한 기술

- HTML, CSS, JavaScript만 사용 (외부 라이브러리 없음)
- `localStorage`: 할 일, 점수, 테마, 소리 설정을 브라우저에 저장
- Web Audio API: 음원 파일 없이 코드로 효과음 생성
- GitHub Pages: 웹 배포

> 저장된 데이터는 사용하는 브라우저 안에만 남습니다. 다른 브라우저나 기기와는 공유되지 않고, 브라우저의 사이트 데이터를 지우면 함께 지워집니다.
