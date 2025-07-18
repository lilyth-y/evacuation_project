# 3D 대피 시뮬레이션 시스템 POC

실시간 센서 데이터와 군중 분석을 기반으로 한 3D 대피 경로 시뮬레이션 및 안내 시스템의 POC(Proof of Concept)입니다.

## 프로젝트 구조

```
evacuation-simulation-poc/
├── models/                          # 3D 모델 파일
│   └── UE22-Base_MN_1111-LR-Existant.ifc  # EPFL/CNPA IFC 모델
├── src/                             # 소스 코드
│   ├── app.js                       # 메인 애플리케이션
│   └── mock-data/                   # 모의 데이터 생성기
├── index.html                       # 메인 HTML 파일
├── package.json                     # 프로젝트 설정
└── README.md                        # 프로젝트 문서
```

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm start
```

또는

```bash
npm run dev
```

### 3. 브라우저에서 확인
- http://localhost:8080 으로 접속

## 주요 기능

### 현재 구현된 기능
- ✅ Cesium.js 기반 3D 뷰어
- ✅ 직관적 UI 패널 (층 선택, 알림, 안내)
- ✅ 모의 데이터 생성기 (화재, 군중, 센서)
- ✅ MQTT 시뮬레이션

### 향후 구현 예정
- 🔄 IFC 모델 로드 및 시각화
- ⏳ 경로 탐색 알고리즘 (A* + 혼잡도 가중치)
- ⏳ Crowd Feedback Loop
- ⏳ 실시간 경로 시각화
- ⏳ 대피 안내 시스템

## 기술 스택

- **3D 시각화**: Cesium.js
- **BIM 처리**: IFC.js (예정)
- **모의 데이터**: JavaScript
- **UI**: HTML5, CSS3, JavaScript

## POC 진행 상황

1. ✅ POC 대상 건물 선정 (EPFL/CNPA IFC 모델)
2. 🔄 기본 3D 뷰어 및 UI 구현 (진행 중)
3. ⏳ IFC 모델 로드 및 시각화
4. ⏳ 모의 데이터 제너레이터 완성
5. ⏳ 경로 탐색 알고리즘 구현
6. ⏳ Crowd Feedback Loop 구현
7. ⏳ 실시간 시각화 완성

## 사용법

1. 애플리케이션을 실행하면 3D 뷰어가 표시됩니다
2. 좌측 상단에서 층을 선택할 수 있습니다
3. 우측 상단에서 재난 알림을 확인할 수 있습니다
4. 하단에서 대피 안내를 확인할 수 있습니다

## 개발 참고사항

- 현재는 모의 데이터만 사용합니다
- 실제 센서 연동은 향후 구현 예정입니다
- IFC 모델 로드는 web-ifc 라이브러리를 사용할 예정입니다