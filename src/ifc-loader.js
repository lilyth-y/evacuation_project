// IFC 모델 로더 클래스
import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// BVH 성능 최적화
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.acceleratedRaycast = acceleratedRaycast;

class IFCLoaderManager {
    constructor() {
        this.ifcLoader = null;
        this.scene = null;
        this.model = null;
        this.buildingData = {
            floors: [],
            spaces: [],
            paths: [],
            obstacles: []
        };
        
        this.init();
    }
    
    async init() {
        try {
            // IFC 로더 초기화
            this.ifcLoader = new IFCLoader();
            await this.ifcLoader.ifcManager.setWasmPath('./');
            
            console.log('IFC 로더 초기화 완료');
        } catch (error) {
            console.error('IFC 로더 초기화 오류:', error);
        }
    }
    
    async loadIFCModel(filePath) {
        try {
            console.log('IFC 모델 로딩 시작:', filePath);
            
            // IFC 파일 로드
            const model = await this.ifcLoader.loadAsync(filePath);
            this.model = model;
            
            // 건물 데이터 분석
            await this.analyzeBuildingStructure();
            
            console.log('IFC 모델 로딩 완료');
            return model;
            
        } catch (error) {
            console.error('IFC 모델 로딩 오류:', error);
            throw error;
        }
    }
    
    async analyzeBuildingStructure() {
        if (!this.model) return;
        
        try {
            // 층 정보 추출
            await this.extractFloorData();
            
            // 공간 정보 추출
            await this.extractSpaceData();
            
            // 경로 정보 추출
            await this.extractPathData();
            
            // 장애물 정보 추출
            await this.extractObstacleData();
            
            console.log('건물 구조 분석 완료:', this.buildingData);
            
        } catch (error) {
            console.error('건물 구조 분석 오류:', error);
        }
    }
    
    async extractFloorData() {
        try {
            // IFC Building Storey 요소들 추출
            const storeys = await this.ifcLoader.ifcManager.getAllItemsOfType(
                this.model.modelID, 
                this.ifcLoader.ifcManager.IFC.BUILDINGSTOREY, 
                false
            );
            
            this.buildingData.floors = storeys.map(storey => ({
                id: storey.GlobalId.value,
                name: storey.Name?.value || 'Unknown Floor',
                elevation: storey.Elevation?.value || 0,
                height: storey.Height?.value || 3.0
            }));
            
            console.log('층 정보 추출 완료:', this.buildingData.floors);
            
        } catch (error) {
            console.error('층 정보 추출 오류:', error);
        }
    }
    
    async extractSpaceData() {
        try {
            // IFC Space 요소들 추출
            const spaces = await this.ifcLoader.ifcManager.getAllItemsOfType(
                this.model.modelID, 
                this.ifcLoader.ifcManager.IFC.SPACE, 
                false
            );
            
            this.buildingData.spaces = spaces.map(space => ({
                id: space.GlobalId.value,
                name: space.Name?.value || 'Unknown Space',
                floorId: space.ContainedInStructure?.[0]?.RelatingStructure?.GlobalId?.value,
                area: space.GrossFloorArea?.value || 0,
                volume: space.GrossVolume?.value || 0
            }));
            
            console.log('공간 정보 추출 완료:', this.buildingData.spaces);
            
        } catch (error) {
            console.error('공간 정보 추출 오류:', error);
        }
    }
    
    async extractPathData() {
        try {
            // IFC Circulation Segment 요소들 추출 (통로, 계단 등)
            const circulationSegments = await this.ifcLoader.ifcManager.getAllItemsOfType(
                this.model.modelID, 
                this.ifcLoader.ifcManager.IFC.CIRCULATIONSEGMENT, 
                false
            );
            
            this.buildingData.paths = circulationSegments.map(segment => ({
                id: segment.GlobalId.value,
                name: segment.Name?.value || 'Unknown Path',
                type: segment.PredefinedType?.value || 'STAIR',
                width: segment.Width?.value || 1.0,
                length: segment.Length?.value || 1.0
            }));
            
            console.log('경로 정보 추출 완료:', this.buildingData.paths);
            
        } catch (error) {
            console.error('경로 정보 추출 오류:', error);
        }
    }
    
    async extractObstacleData() {
        try {
            // IFC Wall, Column 등 장애물 요소들 추출
            const walls = await this.ifcLoader.ifcManager.getAllItemsOfType(
                this.model.modelID, 
                this.ifcLoader.ifcManager.IFC.WALL, 
                false
            );
            
            const columns = await this.ifcLoader.ifcManager.getAllItemsOfType(
                this.model.modelID, 
                this.ifcLoader.ifcManager.IFC.COLUMN, 
                false
            );
            
            this.buildingData.obstacles = [
                ...walls.map(wall => ({
                    id: wall.GlobalId.value,
                    type: 'WALL',
                    name: wall.Name?.value || 'Unknown Wall'
                })),
                ...columns.map(column => ({
                    id: column.GlobalId.value,
                    type: 'COLUMN',
                    name: column.Name?.value || 'Unknown Column'
                }))
            ];
            
            console.log('장애물 정보 추출 완료:', this.buildingData.obstacles);
            
        } catch (error) {
            console.error('장애물 정보 추출 오류:', error);
        }
    }
    
    getFloorData(floorId) {
        return this.buildingData.floors.find(floor => floor.id === floorId);
    }
    
    getSpacesByFloor(floorId) {
        return this.buildingData.spaces.filter(space => space.floorId === floorId);
    }
    
    getPathsByFloor(floorId) {
        // 층별 경로 필터링 (향후 구현)
        return this.buildingData.paths;
    }
    
    getObstaclesByFloor(floorId) {
        // 층별 장애물 필터링 (향후 구현)
        return this.buildingData.obstacles;
    }
    
    // 경로 탐색용 그리드 생성
    generateNavigationGrid(floorId) {
        const floor = this.getFloorData(floorId);
        const spaces = this.getSpacesByFloor(floorId);
        const paths = this.getPathsByFloor(floorId);
        const obstacles = this.getObstaclesByFloor(floorId);
        
        // 간단한 그리드 생성 (향후 실제 건물 구조 기반으로 개선)
        const gridSize = 1.0; // 1미터 간격
        const gridWidth = 100;
        const gridHeight = 100;
        
        const grid = [];
        for (let x = 0; x < gridWidth; x++) {
            grid[x] = [];
            for (let z = 0; z < gridHeight; z++) {
                grid[x][z] = {
                    x: x * gridSize,
                    z: z * gridSize,
                    walkable: true,
                    cost: 1.0,
                    density: 0.0
                };
            }
        }
        
        // 장애물 적용
        obstacles.forEach(obstacle => {
            // 간단한 장애물 배치 (실제로는 IFC 좌표 기반)
            const obstacleX = Math.floor(Math.random() * gridWidth);
            const obstacleZ = Math.floor(Math.random() * gridHeight);
            
            if (grid[obstacleX] && grid[obstacleX][obstacleZ]) {
                grid[obstacleX][obstacleZ].walkable = false;
                grid[obstacleX][obstacleZ].cost = Infinity;
            }
        });
        
        return grid;
    }
}

export default IFCLoaderManager;