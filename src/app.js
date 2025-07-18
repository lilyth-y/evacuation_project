// Cesium ion 토큰 설정 (반드시 Viewer 생성 전에 실행)
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3NjczNzYwOS0xNmQ1LTQ3Y2ItOThlMS1jZjk2MTdmMDQ1N2MiLCJpZCI6MzIyNjA2LCJpYXQiOjE3NTI4MTQ3ODN9.acLcxmOGnZY3LCmRb7ifLn8nTZjexMv_knDw1USvjfo';
// 3D 대피 시뮬레이션 시스템 POC
class EvacuationSimulation {
    constructor() {
        this.viewer = null;
        this.tileset = null;
        this.mockData = null;
        this.currentFloor = 'all';
        this.alertLog = [];
        
        // 새로운 컴포넌트들
        this.ifcLoader = null;
        this.pathfinding = null;
        this.crowdSimulator = null;
        this.buildingData = null;
        this.ifcIntegration = null;
        this.visualization = null;
        this.bimTileset = null;    // BIM 정밀 모델
        
        this.init();
    }
    
    async init() {
        try {
            // Cesium 뷰어 초기화
            // createWorldTerrain() 가 없으면 타원체 지형으로 폴백
            const terrainProvider = (typeof Cesium.createWorldTerrain === 'function')
                ? Cesium.createWorldTerrain()
                : new Cesium.EllipsoidTerrainProvider();

            this.viewer = new Cesium.Viewer('cesiumContainer', {
                terrainProvider: terrainProvider,
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                animation: false,
                timeline: false,
                fullscreenButton: false
            });
            
            // 베이스맵 최소화 (건물 중심)
            // 줄무늬 배경 대신 기본 지구본·하늘 유지
            this.viewer.scene.globe.show = true;
            this.viewer.scene.skyAtmosphere.show = true;

            /* 1) 기본 World Imagery 레이어 추가 (지구본 텍스처 복원) */
            try {
                const worldImagery = await Cesium.IonImageryProvider.fromAssetId(2);
                this.viewer.imageryLayers.addImageryProvider(worldImagery);
            } catch(e){ console.warn('World imagery 로드 실패', e); }

            /* 2) OSM Buildings 타일셋 로드 (직선형 도시 모델) */
            try {
                const osmTileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188, {
                    maximumScreenSpaceError: 1.5
                });
                this.viewer.scene.primitives.add(osmTileset);
            } catch(e){ console.warn('OSM Buildings 로드 실패', e); }

            /* 3) 카메라를 서울 상공(임의)로 이동 */
            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(126.9780, 37.5665, 3000)
            });

            /* 4) 샘플 BIM(파워플랜트) 타일셋 로드 - Asset ID 75343 */
            try {
                this.bimTileset = await Cesium.Cesium3DTileset.fromIonAssetId(75343, {
                    maximumScreenSpaceError: 1.0
                });
                this.viewer.scene.primitives.add(this.bimTileset);
                // 건물 확대
                this.viewer.zoomTo(this.bimTileset).catch(()=>{});

                // ── 내부 가시화 준비 : 타일셋이 로드된 뒤 외벽 반투명 + 단면 절단 ──
                this.bimTileset.readyPromise.then(()=>{
                    // 외벽 15% 투명
                    this.bimTileset.style = new Cesium.Cesium3DTileStyle({
                        color: "color('white',0.15)"
                    });

                    // X-방향으로 한쪽 벽 컷팅 (서쪽 20m, 동쪽 15m)
                    this.bimTileset.clippingPlanes = new Cesium.ClippingPlaneCollection({
                        planes:[
                            new Cesium.ClippingPlane(new Cesium.Cartesian3( 1,0,0), -20),
                            new Cesium.ClippingPlane(new Cesium.Cartesian3(-1,0,0),  15)
                        ],
                        unionClippingRegions:true
                    });
                });
            } catch(e){ console.warn('BIM 타일셋 로드 실패', e); }
            
            // Google Photorealistic 3D Tiles 로드 (Asset ID 2275207)
            try {
                const googleTileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207, {
                    maximumScreenSpaceError: 1.5
                });
                this.viewer.scene.primitives.add(googleTileset);
                // 초기 확대 위치 설정 (실패해도 무시)
                this.viewer.zoomTo(googleTileset).catch(() => {});
            } catch (e) {
                console.warn('Google Photorealistic 3D Tiles 로드 실패', e);
            }
            
            // 모의 데이터 초기화
            this.mockData = new MockDataGenerator();
            
            // 경로 탐색 알고리즘 초기화
            this.pathfinding = new PathfindingAlgorithm();
            
            // 군중 시뮬레이터 초기화
            this.crowdSimulator = new CrowdSimulator();
            this.crowdSimulator.setPathfinding(this.pathfinding);
            
            // IFC 통합 초기화
            this.ifcIntegration = new IFCIntegration();
            await this.ifcIntegration.init();
            
            // 시각화 매니저 초기화
            this.visualization = new VisualizationManager(this.viewer);
            
            // 대피 지점 및 화재 위치 설정
            this.setupSimulationEnvironment();
            
            // UI 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 초기 상태 설정
            this.updateStatus('시스템 초기화 완료', 'safe');
            this.addAlert('시스템이 성공적으로 초기화되었습니다.');
            
            // 시뮬레이션 시작
            this.startSimulation();
            
            // IFC 모델 로드 (향후 구현)
            // await this.loadIFCModel();
            
        } catch (error) {
            console.error('초기화 오류:', error);
            this.updateStatus('초기화 오류', 'danger');
        }
    }
    
    setupEventListeners() {
        // 층 선택 이벤트
        document.getElementById('floorSelect').addEventListener('change', (e) => {
            this.currentFloor = e.target.value;
            this.onFloorChange();
            // 층 클리핑 적용
            this.applyFloorClipping(this.currentFloor);
        });
        
        // 시뮬레이션 버튼 이벤트
        document.getElementById('startSimBtn').addEventListener('click', () => {
            this.startSimulation();
            this.updateSimulationButtons(true);
        });
        
        document.getElementById('stopSimBtn').addEventListener('click', () => {
            this.stopSimulation();
            this.updateSimulationButtons(false);
        });
    }
    
    onFloorChange() {
        console.log(`층 변경: ${this.currentFloor}`);
        this.addAlert(`층 ${this.currentFloor}로 전환되었습니다.`);
        
        // 층별 시각화 업데이트 (향후 구현)
        this.updateFloorVisualization();
    }
    
    updateFloorVisualization() {
        if (!this.ifcIntegration) return;
        
        try {
            // 선택된 층의 데이터 가져오기
            const floorData = this.ifcIntegration.filterByFloor(this.currentFloor);
            if (!floorData) return;
            
            // 층별 공간 정보 표시
            const spaces = this.ifcIntegration.getSpacesByFloor(this.currentFloor);
            const paths = this.ifcIntegration.getPathsByFloor(this.currentFloor);
            const obstacles = this.ifcIntegration.getObstaclesByFloor(this.currentFloor);
            
            // 안내 패널 업데이트
            let guidanceText = `층 ${this.currentFloor} 정보:\n`;
            guidanceText += `- 공간: ${spaces.length}개\n`;
            guidanceText += `- 경로: ${paths.length}개\n`;
            guidanceText += `- 장애물: ${obstacles.length}개`;
            
            this.updateGuidance(guidanceText);
            
            // 경로 탐색 그리드 업데이트
            const grid = this.ifcIntegration.generateNavigationGrid(this.currentFloor);
            if (grid && this.crowdSimulator) {
                this.crowdSimulator.grid = grid;
            }
            
        } catch (error) {
            console.error('층별 시각화 업데이트 오류:', error);
        }
    }
    
    updateStatus(message, type = 'safe') {
        const statusElement = document.querySelector('.ui-panel.top-left span:last-child');
        const indicator = document.querySelector('.status-indicator');
        
        if (statusElement) {
            statusElement.textContent = `시스템 상태: ${message}`;
        }
        
        if (indicator) {
            indicator.className = `status-indicator status-${type}`;
        }
    }
    
    addAlert(message) {
        const alertLog = document.getElementById('alertLog');
        const timestamp = new Date().toLocaleTimeString();
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = `<strong>${timestamp}</strong>: ${message}`;
        alertLog.appendChild(alertDiv);
        
        // 최대 10개 알림만 유지
        while (alertLog.children.length > 10) {
            alertLog.removeChild(alertLog.firstChild);
        }
        
        this.alertLog.push({ message, timestamp });
    }
    
    updateGuidance(message) {
        const guidanceText = document.getElementById('guidanceText');
        if (guidanceText) {
            guidanceText.textContent = message;
        }
    }
    
    updateSimulationButtons(isRunning) {
        const startBtn = document.getElementById('startSimBtn');
        const stopBtn = document.getElementById('stopSimBtn');
        
        if (isRunning) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }
    
    // 향후 구현할 메서드들
    async loadIFCModel() {
        try {
            if (!this.ifcIntegration) {
                throw new Error('IFC 통합이 초기화되지 않았습니다.');
            }
            
            // IFC 모델 로드
            const model = await this.ifcIntegration.loadIFCModel('./models/UE22-Base_MN_1111-LR-Existant.ifc');
            
            // Cesium Tileset 생성
            const tileset = this.ifcIntegration.createCesiumTileset();
            if (tileset) {
                this.tileset = tileset;
                this.viewer.scene.primitives.add(tileset);
                
                // 건물 정보 표시
                const buildingInfo = this.ifcIntegration.getBuildingInfo();
                this.addAlert(`건물 로드 완료: ${buildingInfo.name} (${buildingInfo.floors}층)`);
            }
            
            return model;
        } catch (error) {
            console.error('IFC 모델 로드 오류:', error);
            this.addAlert('IFC 모델 로드 실패 - 모의 데이터 사용');
        }
    }
    
    setupSimulationEnvironment() {
        // 대피 지점 설정
        const evacuationPoints = [
            { x: 10, z: 10, name: '출구 A' },
            { x: 90, z: 10, name: '출구 B' },
            { x: 50, z: 90, name: '출구 C' }
        ];
        this.crowdSimulator.setEvacuationPoints(evacuationPoints);
        
        // 화재 위치 설정
        const fireLocations = [
            { x: 30, z: 30, radius: 5, intensity: 80 }
        ];
        this.crowdSimulator.setFireLocations(fireLocations);
        
        // 시각화 설정
        this.visualization.visualizeEvacuationPoints(evacuationPoints);
        this.visualization.visualizeFireSpread(fireLocations);
        
        // 건물 중심으로 카메라 이동
        this.visualization.flyToBuilding();
        
        this.addAlert('시뮬레이션 환경 설정 완료');
    }
    
    startSimulation() {
        // 군중 시뮬레이션 시작
        this.crowdSimulator.startSimulation();
        
        // 모의 데이터 시뮬레이션 시작
        this.mockData.startSimulation();
        
        // 실시간 시각화 업데이트 시작
        this.startVisualizationUpdates();
        
        this.addAlert('시뮬레이션 시작');
        this.updateStatus('시뮬레이션 실행 중', 'safe');
    }
    
    stopSimulation() {
        // 군중 시뮬레이션 중지
        this.crowdSimulator.stopSimulation();
        
        // 모의 데이터 시뮬레이션 중지
        this.mockData.stopSimulation();
        
        // 실시간 시각화 업데이트 중지
        this.stopVisualizationUpdates();
        
        this.addAlert('시뮬레이션 중지');
        this.updateStatus('시뮬레이션 중지됨', 'warning');
    }
    
    startVisualizationUpdates() {
        // 실시간 시각화 업데이트 (1초마다)
        this.visualizationInterval = setInterval(() => {
            this.updateVisualization();
        }, 1000);
    }
    
    stopVisualizationUpdates() {
        if (this.visualizationInterval) {
            clearInterval(this.visualizationInterval);
            this.visualizationInterval = null;
        }
    }
    
    updateVisualization() {
        if (!this.visualization || !this.crowdSimulator) return;
        
        try {
            // 화재 확산 시각화 업데이트
            const fireLocations = this.crowdSimulator.settings.fireLocations;
            this.visualization.visualizeFireSpread(fireLocations);
            
            // 군중 밀집도 시각화 업데이트
            const crowdData = this.crowdSimulator.getCrowdData();
            this.visualization.visualizeCrowdDensity(crowdData);
            
            // 통계 정보 업데이트
            const stats = this.crowdSimulator.getStatistics();
            this.updateStatistics(stats);
            
        } catch (error) {
            console.error('시각화 업데이트 오류:', error);
        }
    }
    
    updateStatistics(stats) {
        // 통계 정보를 안내 패널에 표시
        let guidanceText = `실시간 통계:\n`;
        guidanceText += `- 총 에이전트: ${stats.totalAgents}명\n`;
        guidanceText += `- 대피 완료: ${stats.evacuatedAgents}명\n`;
        guidanceText += `- 평균 밀집도: ${stats.averageDensity.toFixed(1)}%\n`;
        guidanceText += `- 화재 지점: ${stats.fireLocations}개`;
        
        this.updateGuidance(guidanceText);
    }
    
    startMockSimulation() {
        // 모의 데이터 시뮬레이션 시작
        this.mockData.startSimulation();
    }
    
    stopMockSimulation() {
        // 모의 데이터 시뮬레이션 중지
        this.mockData.stopSimulation();
    }

    /* 층 클리핑 (heightPerFloor 3m) */
    applyFloorClipping(floor) {
        if (!this.bimTileset) return;
        if (floor === 'all') {
            this.viewer.scene.clippingPlanes = undefined;
            return;
        }
        const h = 3.0;
        const bottom = (parseInt(floor)-1)*h;
        const top = bottom + h;
        this.viewer.scene.clippingPlanes = new Cesium.ClippingPlaneCollection({
            planes:[
                new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 1,0), -bottom),
                new Cesium.ClippingPlane(new Cesium.Cartesian3(0,-1,0),  top)
            ],
            unionClippingRegions:true
        });
    }
}

// 모의 데이터 생성기 클래스
class MockDataGenerator {
    constructor() {
        this.isRunning = false;
        this.simulationInterval = null;
        this.fireEvents = [];
        this.crowdData = [];
    }
    
    startSimulation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.simulationInterval = setInterval(() => {
            this.generateMockData();
        }, 1000); // 1초마다 데이터 생성
        
        console.log('모의 시뮬레이션 시작');
    }
    
    stopSimulation() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        console.log('모의 시뮬레이션 중지');
    }
    
    generateMockData() {
        // 화재 이벤트 생성 (10% 확률)
        if (Math.random() < 0.1) {
            this.generateFireEvent();
        }
        
        // 군중 데이터 생성
        this.generateCrowdData();
        
        // 센서 데이터 생성
        this.generateSensorData();
    }
    
    generateFireEvent() {
        const fireEvent = {
            id: Date.now(),
            type: 'fire',
            location: {
                x: Math.random() * 100,
                y: Math.random() * 100,
                z: Math.floor(Math.random() * 3) + 1
            },
            intensity: Math.random() * 100,
            timestamp: new Date()
        };
        
        this.fireEvents.push(fireEvent);
        console.log('화재 이벤트 생성:', fireEvent);
    }
    
    generateCrowdData() {
        const crowdData = {
            timestamp: new Date(),
            floor: Math.floor(Math.random() * 3) + 1,
            density: Math.random() * 100,
            flowDirection: {
                x: Math.random() * 2 - 1,
                y: Math.random() * 2 - 1
            }
        };
        
        this.crowdData.push(crowdData);
    }
    
    generateSensorData() {
        // 온도, 연기, 진동 센서 데이터 생성
        const sensorData = {
            temperature: 20 + Math.random() * 30,
            smoke: Math.random() * 100,
            vibration: Math.random() * 10,
            timestamp: new Date()
        };
        
        // MQTT 시뮬레이션 (실제로는 MQTT 브로커로 전송)
        this.publishMockMQTT(sensorData);
    }
    
    publishMockMQTT(data) {
        // MQTT 메시지 시뮬레이션
        const mqttMessage = {
            topic: '/sensor/data',
            payload: JSON.stringify(data),
            timestamp: new Date()
        };
        
        console.log('MQTT 메시지 시뮬레이션:', mqttMessage);
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.evacuationApp = new EvacuationSimulation();
});