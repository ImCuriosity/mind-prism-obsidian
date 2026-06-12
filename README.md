# Mind Prism — Obsidian 다중 투사 & 동적 군집화 뷰어

무정형 지식 그래프와 PARA 계층형 트리를 **함께** 보여주는 옵시디언 하이브리드 뷰어 플러그인입니다.
D3.js force 시뮬레이션으로 노드가 카테고리별 중력점으로 동적 군집(cluster)을 형성합니다.

## 주요 기능

- **하이브리드 레이아웃**: 좌측 계층형 텍스트 트리(`ul/li`) + 우측 D3 인터랙티브 그래프(SVG)
- **모드 전환**
  - *무정형 모드*: `forceManyBody`(반발) + `forceCenter`(중앙 집중)
  - *PARA 분류 모드*: Projects / Areas / Resources / Archives 4개 중력점으로 `forceX`/`forceY` 군집화
- **데이터 파싱**: `metadataCache.resolvedLinks` + 프론트매터(`type`/`category`)·태그(`#project` 등, 한글 별칭 포함)로 자동 분류
- **인터랙션**: 노드 드래그, 줌/팬, 노드·트리 클릭 시 노트 열기
- **반응형**: 좁은 화면(모바일)에서는 좌우 → 상하 분할 (`isDesktopOnly: false`)

## 개발 환경 설정 (다른 PC에서)

```bash
git clone https://github.com/ImCuriosity/mind-prism-obsidian.git
cd mind-prism-obsidian
npm install          # 의존성 설치 (d3, obsidian, esbuild 등)
npm run dev          # 워치 모드 (저장 시 자동 리빌드)
# 또는
npm run build        # 타입체크 + 프로덕션 번들 (main.js 생성)
```

## 볼트에 설치하기

빌드 후 생성된 **세 파일**을 볼트의 플러그인 폴더에 복사합니다:

```
<볼트>/.obsidian/plugins/para-cluster-viewer/
├─ main.js          # npm run build 결과물
├─ manifest.json
└─ styles.css
```

이후 옵시디언에서 **설정 → 커뮤니티 플러그인 → "PARA Cluster Viewer" 활성화**.
좌측 리본의 갈래(⑂) 아이콘 또는 명령 팔레트 "PARA 군집 뷰어 열기"로 실행합니다.

> `main.js`는 빌드 산출물이라 git에 포함되지 않습니다(.gitignore). 클론 후 `npm run build`로 생성하세요.

## 소스 구조

| 파일 | 역할 |
|------|------|
| `main.ts` | Plugin + ItemView, 하이브리드 레이아웃·모드 전환 와이어링 |
| `src/types.ts` | 공용 데이터 모델, PARA 카테고리/색상 상수 |
| `src/dataParser.ts` | 볼트 → 노드/엣지/위상정렬 트리 변환 |
| `src/graphEngine.ts` | D3 force 시뮬레이션, 모드별 force 동적 교체 |
| `src/treeRenderer.ts` | 계층형 `ul/li` 트리 렌더링 |

## 라이선스

MIT
