# Eye 2048

눈동자의 시선 방향(상·하·좌·우)으로 조작하는 2048 게임입니다.
브라우저의 웹캠과 [MediaPipe Face Mesh](https://github.com/google/mediapipe)를 사용해
홍채(iris) 위치를 추적합니다.

## 모바일 / PC 웹 접속 URL

GitHub Pages로 배포되며, 모바일·데스크톱 브라우저에서 동일하게 접속할 수 있습니다.

> **🌐 https://shinhyuk.github.io/2024-Eye/**

> ⚠️ 카메라(`getUserMedia`)는 HTTPS에서만 동작합니다. 위 GitHub Pages 주소는 HTTPS이므로 모바일에서 그대로 사용할 수 있습니다. 로컬에서 `http://`로 띄우면 모바일 카메라가 작동하지 않습니다.

### 최초 1회 설정 (저장소 소유자만)

레포 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정하면 됩니다.
이후 푸시할 때마다 `.github/workflows/pages.yml`이 자동으로 배포합니다.
URL은 `https://<username>.github.io/<repo>/` 패턴으로, 이 레포의 경우 위 주소가 됩니다.

## 모바일 사용 방법

1. 모바일 브라우저(Chrome/Safari)에서 위 URL 접속.
2. **카메라 시작** → 카메라 권한 허용 (전면 카메라 사용).
3. 정면을 응시한 상태에서 **중앙 보정**을 누릅니다.
4. 시선을 위/아래/왼쪽/오른쪽으로 옮기면 그 방향으로 타일이 이동합니다.
5. 카메라 없이도 **터치 스와이프**(보드 위에서 상/하/좌/우)로 조작할 수 있습니다.

## 데스크톱 사용 방법

1. 위 URL 접속, 또는 로컬에서 정적 서버 실행:
   ```bash
   python3 -m http.server 8000
   ```
2. 키보드(방향키 또는 WASD)로 조작 가능.

**민감도**와 **쿨다운** 슬라이더로 시선 감도와 입력 간격을 조절합니다.

## 파일 구조

- `index.html` — UI 레이아웃, 모바일 메타 태그
- `style.css` — 반응형 스타일
- `game.js` — 2048 게임 로직 (`Game2048` 클래스)
- `eyeTracker.js` — 시선 추적 (`EyeTracker` 클래스), 전면 카메라 사용
- `main.js` — DOM 이벤트, 키보드/터치 스와이프, 시선 입력 연결
- `.github/workflows/pages.yml` — GitHub Pages 자동 배포 워크플로
