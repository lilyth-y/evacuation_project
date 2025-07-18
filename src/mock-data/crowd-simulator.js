// 군중 시뮬레이터 클래스
class CrowdSimulator {
    constructor(gridSize = 100) {
        this.gridSize = gridSize;
        this.agents = [];
        this.crowdData = this.initializeCrowdData();
        this.isRunning = false;
        this.simulationInterval = null;
        this.pathfinding = null;
        
        this.settings = {
            maxAgents: 500,
            agentSpeed: 1.0, // 미터/초
            updateInterval: 100, // 밀리초
            evacuationPoints: [],
            fireLocations: []
        };
    }
    
    initializeCrowdData() {
        const data = [];
        for (let x = 0; x < this.gridSize; x++) {
            data[x] = [];
            for (let z = 0; z < this.gridSize; z++) {
                data[x][z] = {
                    density: 0,
                    flowDirection: { x: 0, z: 0 },
                    agents: []
                };
            }
        }
        return data;
    }
    
    setPathfinding(pathfinding) {
        this.pathfinding = pathfinding;
    }
    
    setEvacuationPoints(points) {
        this.settings.evacuationPoints = points;
    }
    
    setFireLocations(locations) {
        this.settings.fireLocations = locations;
    }
    
    startSimulation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.simulationInterval = setInterval(() => {
            this.updateSimulation();
        }, this.settings.updateInterval);
        
        console.log('군중 시뮬레이션 시작');
    }
    
    stopSimulation() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        console.log('군중 시뮬레이션 중지');
    }
    
    updateSimulation() {
        // 에이전트 업데이트
        this.updateAgents();
        
        // 군중 데이터 업데이트
        this.updateCrowdData();
        
        // 화재 확산 시뮬레이션
        this.simulateFireSpread();
        
        // 경로 재탐색 (필요시)
        this.replanPathsIfNeeded();
    }
    
    updateAgents() {
        for (let i = this.agents.length - 1; i >= 0; i--) {
            const agent = this.agents[i];
            
            // 에이전트 이동
            this.moveAgent(agent);
            
            // 목적지 도착 확인
            if (this.hasReachedDestination(agent)) {
                this.agents.splice(i, 1);
                continue;
            }
            
            // 경로 업데이트 (필요시)
            if (this.shouldReplanPath(agent)) {
                this.replanAgentPath(agent);
            }
        }
        
        // 새로운 에이전트 생성 (필요시)
        this.spawnNewAgents();
    }
    
    moveAgent(agent) {
        if (!agent.path || agent.path.length === 0) return;
        
        const targetNode = agent.path[agent.pathIndex];
        const direction = {
            x: targetNode.x - agent.x,
            z: targetNode.z - agent.z
        };
        
        // 거리 계산
        const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        
        if (distance < 0.1) {
            // 목표 노드에 도착
            agent.pathIndex++;
            if (agent.pathIndex >= agent.path.length) {
                agent.pathIndex = agent.path.length - 1;
            }
        } else {
            // 이동
            const speed = this.settings.agentSpeed * (this.settings.updateInterval / 1000);
            const moveDistance = Math.min(speed, distance);
            
            const normalizedDirection = {
                x: direction.x / distance,
                z: direction.z / distance
            };
            
            agent.x += normalizedDirection.x * moveDistance;
            agent.z += normalizedDirection.z * moveDistance;
        }
    }
    
    hasReachedDestination(agent) {
        if (!agent.path || agent.path.length === 0) return false;
        
        const lastNode = agent.path[agent.path.length - 1];
        const distance = Math.sqrt(
            Math.pow(agent.x - lastNode.x, 2) + 
            Math.pow(agent.z - lastNode.z, 2)
        );
        
        return distance < 0.5;
    }
    
    shouldReplanPath(agent) {
        // 화재 지역 접근 시 경로 재탐색
        for (const fireLocation of this.settings.fireLocations) {
            const distance = Math.sqrt(
                Math.pow(agent.x - fireLocation.x, 2) + 
                Math.pow(agent.z - fireLocation.z, 2)
            );
            
            if (distance < fireLocation.radius) {
                return true;
            }
        }
        
        return false;
    }
    
    replanAgentPath(agent) {
        if (!this.pathfinding) return;
        
        const start = { x: Math.floor(agent.x), z: Math.floor(agent.z) };
        const goal = this.getNearestEvacuationPoint(agent);
        
        if (goal) {
            const newPath = this.pathfinding.findPath(start, goal, this.getGrid(), this.crowdData);
            if (newPath) {
                agent.path = newPath;
                agent.pathIndex = 0;
            }
        }
    }
    
    getNearestEvacuationPoint(agent) {
        let nearestPoint = null;
        let minDistance = Infinity;
        
        for (const point of this.settings.evacuationPoints) {
            const distance = Math.sqrt(
                Math.pow(agent.x - point.x, 2) + 
                Math.pow(agent.z - point.z, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        }
        
        return nearestPoint;
    }
    
    spawnNewAgents() {
        if (this.agents.length >= this.settings.maxAgents) return;
        
        // 랜덤 위치에 새로운 에이전트 생성
        const spawnChance = 0.1; // 10% 확률
        
        if (Math.random() < spawnChance) {
            const agent = this.createAgent();
            this.agents.push(agent);
        }
    }
    
    createAgent() {
        const x = Math.random() * this.gridSize;
        const z = Math.random() * this.gridSize;
        
        const agent = {
            id: Date.now() + Math.random(),
            x: x,
            z: z,
            path: [],
            pathIndex: 0,
            speed: this.settings.agentSpeed,
            type: Math.random() < 0.1 ? 'elderly' : 'normal' // 10% 노약자
        };
        
        // 초기 경로 설정
        const goal = this.getNearestEvacuationPoint(agent);
        if (goal && this.pathfinding) {
            const start = { x: Math.floor(x), z: Math.floor(z) };
            const path = this.pathfinding.findPath(start, goal, this.getGrid(), this.crowdData);
            if (path) {
                agent.path = path;
            }
        }
        
        return agent;
    }
    
    updateCrowdData() {
        // 기존 데이터 초기화
        for (let x = 0; x < this.gridSize; x++) {
            for (let z = 0; z < this.gridSize; z++) {
                this.crowdData[x][z].density = 0;
                this.crowdData[x][z].agents = [];
                this.crowdData[x][z].flowDirection = { x: 0, z: 0 };
            }
        }
        
        // 에이전트별 데이터 업데이트
        for (const agent of this.agents) {
            const gridX = Math.floor(agent.x);
            const gridZ = Math.floor(agent.z);
            
            if (gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize) {
                this.crowdData[gridX][gridZ].density++;
                this.crowdData[gridX][gridZ].agents.push(agent);
                
                // 흐름 방향 계산
                if (agent.path && agent.pathIndex < agent.path.length) {
                    const targetNode = agent.path[agent.pathIndex];
                    this.crowdData[gridX][gridZ].flowDirection.x += targetNode.x - agent.x;
                    this.crowdData[gridX][gridZ].flowDirection.z += targetNode.z - agent.z;
                }
            }
        }
        
        // 흐름 방향 정규화
        for (let x = 0; x < this.gridSize; x++) {
            for (let z = 0; z < this.gridSize; z++) {
                const flow = this.crowdData[x][z].flowDirection;
                const magnitude = Math.sqrt(flow.x * flow.x + flow.z * flow.z);
                
                if (magnitude > 0) {
                    flow.x /= magnitude;
                    flow.z /= magnitude;
                }
            }
        }
    }
    
    simulateFireSpread() {
        for (const fireLocation of this.settings.fireLocations) {
            // 화재 확산 (간단한 원형 확산)
            fireLocation.radius += 0.1; // 초당 0.1미터 확산
            
            // 최대 확산 반경 제한
            fireLocation.radius = Math.min(fireLocation.radius, 50);
        }
    }
    
    replanPathsIfNeeded() {
        // 과밀 지역 감지 시 경로 재탐색
        const overcrowdedThreshold = 20;
        
        for (let x = 0; x < this.gridSize; x++) {
            for (let z = 0; z < this.gridSize; z++) {
                if (this.crowdData[x][z].density > overcrowdedThreshold) {
                    // 해당 지역의 에이전트들 경로 재탐색
                    for (const agent of this.crowdData[x][z].agents) {
                        this.replanAgentPath(agent);
                    }
                }
            }
        }
    }
    
    getGrid() {
        // 간단한 그리드 생성 (실제로는 IFC 모델 기반)
        const grid = [];
        for (let x = 0; x < this.gridSize; x++) {
            grid[x] = [];
            for (let z = 0; z < this.gridSize; z++) {
                grid[x][z] = {
                    walkable: true,
                    cost: 1.0,
                    risk: false
                };
            }
        }
        
        // 화재 지역 위험 표시
        for (const fireLocation of this.settings.fireLocations) {
            const centerX = Math.floor(fireLocation.x);
            const centerZ = Math.floor(fireLocation.z);
            const radius = Math.floor(fireLocation.radius);
            
            for (let x = Math.max(0, centerX - radius); x <= Math.min(this.gridSize - 1, centerX + radius); x++) {
                for (let z = Math.max(0, centerZ - radius); z <= Math.min(this.gridSize - 1, centerZ + radius); z++) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2));
                    if (distance <= radius) {
                        grid[x][z].risk = true;
                        grid[x][z].cost = Infinity;
                    }
                }
            }
        }
        
        return grid;
    }
    
    getCrowdData() {
        return this.crowdData;
    }
    
    getAgents() {
        return this.agents;
    }
    
    getStatistics() {
        return {
            totalAgents: this.agents.length,
            evacuatedAgents: this.settings.maxAgents - this.agents.length,
            averageDensity: this.calculateAverageDensity(),
            fireLocations: this.settings.fireLocations.length
        };
    }
    
    calculateAverageDensity() {
        let totalDensity = 0;
        let count = 0;
        
        for (let x = 0; x < this.gridSize; x++) {
            for (let z = 0; z < this.gridSize; z++) {
                totalDensity += this.crowdData[x][z].density;
                count++;
            }
        }
        
        return count > 0 ? totalDensity / count : 0;
    }
}

export default CrowdSimulator;