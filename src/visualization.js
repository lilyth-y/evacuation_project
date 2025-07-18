// 3D 시각화 클래스
class VisualizationManager {
    // 기준 위도·경도 (프로젝트 테스트용 임의 위치)
    static ORIGIN_LAT = 37.5665;   // 서울 근교
    static ORIGIN_LON = 126.9780;
    static M_TO_DEG_LAT = 1 / 111320;      // 1m ≈ 1/111,320도
    static M_TO_DEG_LON = 1 / (111320 * Math.cos(VisualizationManager.ORIGIN_LAT * Math.PI / 180));

    static localToCart(x, z, height = 0) {
        const lon = VisualizationManager.ORIGIN_LON + x * VisualizationManager.M_TO_DEG_LON;
        const lat = VisualizationManager.ORIGIN_LAT + z * VisualizationManager.M_TO_DEG_LAT;
        return Cesium.Cartesian3.fromDegrees(lon, lat, height);
    }

    constructor(viewer) {
        this.viewer = viewer;
        this.entities = [];
        this.pathEntities = [];
        this.dangerEntities = [];
        this.crowdEntities = [];
    }
    
    // 경로 시각화
    visualizePath(path, color = Cesium.Color.GREEN, width = 3) {
        if (!path || path.length < 2) return;
        
        // 기존 경로 제거
        this.clearPaths();
        
        const positions = path.map(node => VisualizationManager.localToCart(node.x, node.z, 1.5));
        
        const pathEntity = this.viewer.entities.add({
            polyline: {
                positions: positions,
                width: width,
                material: color,
                clampToGround: true
            }
        });
        
        this.pathEntities.push(pathEntity);
        
        // 시작점과 끝점 표시
        this.addPathPoint(path[0], Cesium.Color.BLUE, '시작');
        this.addPathPoint(path[path.length - 1], Cesium.Color.RED, '목적지');
    }
    
    // 다중 경로 시각화
    visualizeMultiplePaths(paths) {
        this.clearPaths();
        
        const colors = [
            Cesium.Color.GREEN,
            Cesium.Color.YELLOW,
            Cesium.Color.CYAN,
            Cesium.Color.MAGENTA
        ];
        
        paths.forEach((pathData, index) => {
            if (pathData.path && pathData.path.length > 1) {
                const color = colors[index % colors.length];
                this.visualizePath(pathData.path, color, 2);
            }
        });
    }
    
    // 위험지역 시각화
    visualizeDangerZone(center, radius, intensity = 0.8) {
        this.clearDangerZones();
        
        const dangerEntity = this.viewer.entities.add({
            position: VisualizationManager.localToCart(center.x, center.z, 1.0),
            ellipsoid: {
                radii: new Cesium.Cartesian3(radius, radius, 2),
                material: Cesium.Color.RED.withAlpha(intensity),
                outline: true,
                outlineColor: Cesium.Color.DARKRED
            }
        });
        
        this.dangerEntities.push(dangerEntity);
    }
    
    // 화재 확산 시각화
    visualizeFireSpread(fireLocations) {
        this.clearDangerZones();
        
        fireLocations.forEach(fire => {
            const intensity = fire.intensity / 100;
            this.visualizeDangerZone(
                { x: fire.x, z: fire.z },
                fire.radius,
                intensity
            );
        });
    }
    
    // 군중 밀집도 히트맵 시각화
    visualizeCrowdDensity(crowdData, gridSize = 100) {
        this.clearCrowdVisualization();
        
        for (let x = 0; x < gridSize; x++) {
            for (let z = 0; z < gridSize; z++) {
                if (crowdData[x] && crowdData[x][z] && crowdData[x][z].density > 0) {
                    const density = crowdData[x][z].density;
                    const normalizedDensity = Math.min(density / 50, 1.0); // 최대 50명으로 정규화
                    
                    // 밀집도에 따른 색상 결정
                    let color;
                    if (normalizedDensity < 0.3) {
                        color = Cesium.Color.GREEN.withAlpha(0.3);
                    } else if (normalizedDensity < 0.7) {
                        color = Cesium.Color.YELLOW.withAlpha(0.5);
                    } else {
                        color = Cesium.Color.RED.withAlpha(0.7);
                    }
                    
                    const crowdEntity = this.viewer.entities.add({
                        position: VisualizationManager.localToCart(x, z, 0.1),
                        ellipsoid: {
                            radii: new Cesium.Cartesian3(0.5, 0.5, 0.1),
                            material: color
                        }
                    });
                    
                    this.crowdEntities.push(crowdEntity);
                    if(crowdEntity.ellipsoid){
                        crowdEntity.ellipsoid.disableDepthTestDistance = Number.POSITIVE_INFINITY;
                    }
                }
            }
        }
    }
    
    // 대피 지점 시각화
    visualizeEvacuationPoints(points) {
        points.forEach((point, index) => {
            const entity = this.viewer.entities.add({
                position: VisualizationManager.localToCart(point.x, point.z, 1.5),
                ellipsoid: {
                    radii: new Cesium.Cartesian3(2, 2, 1),
                    material: Cesium.Color.GREEN,
                    outline: true,
                    outlineColor: Cesium.Color.DARKGREEN
                },
                // 라벨은 billboard 아님 → 클램프
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                label: {
                    text: point.name,
                    font: '14pt sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -30)
                }
            });
            
            this.entities.push(entity);
        });
    }
    
    // 경로점 추가
    addPathPoint(position, color, label) {
        const entity = this.viewer.entities.add({
            position: VisualizationManager.localToCart(position.x, position.z, 1.5),
            ellipsoid: {
                radii: new Cesium.Cartesian3(1, 1, 1),
                material: color
            },
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            label: {
                text: label,
                font: '12pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -20)
            }
        });
        
        this.pathEntities.push(entity);
    }
    
    // 경로 제거
    clearPaths() {
        this.pathEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.pathEntities = [];
    }
    
    // 위험지역 제거
    clearDangerZones() {
        this.dangerEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.dangerEntities = [];
    }
    
    // 군중 시각화 제거
    clearCrowdVisualization() {
        this.crowdEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.crowdEntities = [];
    }
    
    // 모든 시각화 제거
    clearAll() {
        this.clearPaths();
        this.clearDangerZones();
        this.clearCrowdVisualization();
        
        this.entities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.entities = [];
    }
    
    // 카메라를 특정 위치로 이동
    flyToPosition(x, z, height = 50) {
        this.viewer.camera.flyTo({
            destination: VisualizationManager.localToCart(x, z, height),
            orientation: {
                heading: 0.0,
                pitch: -Math.PI / 4,
                roll: 0.0
            }
        });
    }
    
    // 건물 중심으로 카메라 이동
    flyToBuilding() {
        this.viewer.camera.flyTo({
            destination: VisualizationManager.localToCart(50, 50, 100),
            orientation: {
                heading: 0.0,
                pitch: -Math.PI / 3,
                roll: 0.0
            }
        });
    }
}

export default VisualizationManager; 