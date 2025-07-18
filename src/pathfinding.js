// 경로 탐색 알고리즘 클래스
class PathfindingAlgorithm {
    constructor() {
        this.grid = null;
        this.openSet = [];
        this.closedSet = [];
        this.cameFrom = new Map();
        this.gScore = new Map();
        this.fScore = new Map();
        
        // 가중치 설정
        this.weights = {
            baseCost: 1.0,
            densityMultiplier: 2.0,
            riskMultiplier: 10.0,
            maxDensity: 100.0
        };
    }
    
    // A* 알고리즘 구현
    findPath(start, goal, grid, crowdData = null) {
        this.grid = grid;
        this.openSet = [start];
        this.closedSet = [];
        this.cameFrom.clear();
        this.gScore.clear();
        this.fScore.clear();
        
        // 초기화
        this.gScore.set(this.nodeToString(start), 0);
        this.fScore.set(this.nodeToString(start), this.heuristic(start, goal));
        
        while (this.openSet.length > 0) {
            // fScore가 가장 낮은 노드 선택
            const current = this.getLowestFScoreNode();
            
            if (this.nodesEqual(current, goal)) {
                return this.reconstructPath(current);
            }
            
            // 현재 노드를 closed set에서 제거하고 open set에 추가
            this.openSet = this.openSet.filter(node => !this.nodesEqual(node, current));
            this.closedSet.push(current);
            
            // 이웃 노드들 검사
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (this.closedSet.some(node => this.nodesEqual(node, neighbor))) {
                    continue;
                }
                
                const tentativeGScore = this.gScore.get(this.nodeToString(current)) + 
                                      this.getCost(current, neighbor, crowdData);
                
                if (!this.openSet.some(node => this.nodesEqual(node, neighbor))) {
                    this.openSet.push(neighbor);
                } else if (tentativeGScore >= this.gScore.get(this.nodeToString(neighbor))) {
                    continue;
                }
                
                // 더 나은 경로를 찾았음
                this.cameFrom.set(this.nodeToString(neighbor), current);
                this.gScore.set(this.nodeToString(neighbor), tentativeGScore);
                this.fScore.set(this.nodeToString(neighbor), 
                              tentativeGScore + this.heuristic(neighbor, goal));
            }
        }
        
        // 경로를 찾지 못함
        return null;
    }
    
    // 휴리스틱 함수 (맨해튼 거리)
    heuristic(nodeA, nodeB) {
        return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.z - nodeB.z);
    }
    
    // fScore가 가장 낮은 노드 찾기
    getLowestFScoreNode() {
        let lowestNode = this.openSet[0];
        let lowestFScore = this.fScore.get(this.nodeToString(lowestNode)) || Infinity;
        
        for (const node of this.openSet) {
            const fScore = this.fScore.get(this.nodeToString(node)) || Infinity;
            if (fScore < lowestFScore) {
                lowestFScore = fScore;
                lowestNode = node;
            }
        }
        
        return lowestNode;
    }
    
    // 이웃 노드들 가져오기
    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { x: 0, z: 1 },   // 북
            { x: 1, z: 0 },   // 동
            { x: 0, z: -1 },  // 남
            { x: -1, z: 0 },  // 서
            { x: 1, z: 1 },   // 북동
            { x: 1, z: -1 },  // 남동
            { x: -1, z: 1 },  // 북서
            { x: -1, z: -1 }  // 남서
        ];
        
        for (const dir of directions) {
            const neighbor = {
                x: node.x + dir.x,
                z: node.z + dir.z
            };
            
            if (this.isValidNode(neighbor)) {
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }
    
    // 노드가 유효한지 확인
    isValidNode(node) {
        if (!this.grid[node.x] || !this.grid[node.x][node.z]) {
            return false;
        }
        
        return this.grid[node.x][node.z].walkable;
    }
    
    // 노드 간 비용 계산 (혼잡도 및 위험도 반영)
    getCost(fromNode, toNode, crowdData = null) {
        const baseCost = this.grid[toNode.x][toNode.z].cost;
        
        if (baseCost === Infinity) {
            return Infinity;
        }
        
        let totalCost = baseCost;
        
        // 혼잡도 가중치 적용
        if (crowdData && crowdData[toNode.x] && crowdData[toNode.x][toNode.z]) {
            const density = crowdData[toNode.x][toNode.z].density || 0;
            const densityCost = this.weights.densityMultiplier * 
                              Math.pow(density / this.weights.maxDensity, 2);
            totalCost += densityCost;
        }
        
        // 위험도 가중치 적용 (화재, 연기 등)
        if (this.grid[toNode.x][toNode.z].risk) {
            totalCost += this.weights.riskMultiplier;
        }
        
        return totalCost;
    }
    
    // 경로 재구성
    reconstructPath(current) {
        const path = [current];
        
        while (this.cameFrom.has(this.nodeToString(current))) {
            current = this.cameFrom.get(this.nodeToString(current));
            path.unshift(current);
        }
        
        return path;
    }
    
    // 노드를 문자열로 변환 (Map 키로 사용)
    nodeToString(node) {
        return `${node.x},${node.z}`;
    }
    
    // 노드 비교
    nodesEqual(nodeA, nodeB) {
        return nodeA.x === nodeB.x && nodeA.z === nodeB.z;
    }
    
    // 다중 경로 탐색 (대안 경로들)
    findMultiplePaths(start, goal, grid, crowdData = null, numPaths = 3) {
        const paths = [];
        const originalGrid = JSON.parse(JSON.stringify(grid)); // 깊은 복사
        
        for (let i = 0; i < numPaths; i++) {
            const path = this.findPath(start, goal, grid, crowdData);
            
            if (path) {
                paths.push({
                    id: i,
                    path: path,
                    cost: this.calculatePathCost(path, grid, crowdData),
                    length: path.length
                });
                
                // 다음 탐색을 위해 사용된 경로의 비용을 증가시킴
                this.increasePathCost(grid, path, 2.0);
            } else {
                break;
            }
        }
        
        // 비용 순으로 정렬
        paths.sort((a, b) => a.cost - b.cost);
        
        return paths;
    }
    
    // 경로 비용 계산
    calculatePathCost(path, grid, crowdData = null) {
        let totalCost = 0;
        
        for (let i = 1; i < path.length; i++) {
            const fromNode = path[i - 1];
            const toNode = path[i];
            totalCost += this.getCost(fromNode, toNode, crowdData);
        }
        
        return totalCost;
    }
    
    // 경로 비용 증가 (Crowd Feedback Loop)
    increasePathCost(grid, path, multiplier = 1.5) {
        for (const node of path) {
            if (grid[node.x] && grid[node.x][node.z]) {
                grid[node.x][node.z].cost *= multiplier;
            }
        }
    }
    
    // 군중 밀집도 기반 경로 재탐색
    replanPathWithCrowdFeedback(start, goal, grid, crowdData, maxDensity = 50) {
        // 과밀 지역 식별
        const overcrowdedAreas = this.identifyOvercrowdedAreas(grid, crowdData, maxDensity);
        
        // 과밀 지역 비용 증가
        const updatedGrid = this.updateGridWithCrowdData(grid, overcrowdedAreas);
        
        // 경로 재탐색
        return this.findPath(start, goal, updatedGrid, crowdData);
    }
    
    // 과밀 지역 식별
    identifyOvercrowdedAreas(grid, crowdData, maxDensity) {
        const overcrowdedAreas = [];
        
        for (let x = 0; x < grid.length; x++) {
            for (let z = 0; z < grid[x].length; z++) {
                if (crowdData && crowdData[x] && crowdData[x][z]) {
                    const density = crowdData[x][z].density || 0;
                    if (density > maxDensity) {
                        overcrowdedAreas.push({ x, z, density });
                    }
                }
            }
        }
        
        return overcrowdedAreas;
    }
    
    // 군중 데이터로 그리드 업데이트
    updateGridWithCrowdData(grid, overcrowdedAreas) {
        const updatedGrid = JSON.parse(JSON.stringify(grid));
        
        for (const area of overcrowdedAreas) {
            if (updatedGrid[area.x] && updatedGrid[area.x][area.z]) {
                updatedGrid[area.x][area.z].cost *= this.weights.densityMultiplier;
            }
        }
        
        return updatedGrid;
    }
}

export default PathfindingAlgorithm;