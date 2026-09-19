/**
 * DSR (Dynamic Source Routing) Protocol Interactive Visualizer
 * Implements RREQ Discovery Flooding, RREP Reverse Unicast, Route Caching,
 * and Source-Routed DATA Delivery.
 */

// ============================================================================
// 1. Network Graph Model & Topology Generators (Reused from Flooding)
// ============================================================================

class NetworkGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }

    addNode(id, x, y, label = id) {
        if (this.nodes.has(id)) return;
        this.nodes.set(id, {
            id,
            label,
            x,
            y,
            radius: 24,
            isHovered: false,
            isSelected: false,
            isDragging: false
        });
    }

    removeNode(id) {
        this.nodes.delete(id);
        this.edges = this.edges.filter(e => e.u !== id && e.v !== id);
    }

    addEdge(u, v) {
        if (u === v || !this.nodes.has(u) || !this.nodes.has(v)) return;
        const exists = this.edges.some(e => 
            (e.u === u && e.v === v) || (e.u === v && e.u === u)
        );
        if (!exists) {
            this.edges.push({ id: `${u}-${v}`, u, v });
        }
    }

    removeEdge(u, v) {
        this.edges = this.edges.filter(e => 
            !((e.u === u && e.v === v) || (e.u === v && e.v === u))
        );
    }

    getNeighbors(nodeId) {
        const neighbors = [];
        for (const edge of this.edges) {
            if (edge.u === nodeId) neighbors.push(edge.v);
            else if (edge.v === nodeId) neighbors.push(edge.u);
        }
        return neighbors;
    }

    hasEdge(u, v) {
        return this.edges.some(e => 
            (e.u === u && e.v === v) || (e.u === v && e.v === u)
        );
    }

    clear() {
        this.nodes.clear();
        this.edges = [];
    }

    static createMesh(width, height) {
        const g = new NetworkGraph();
        const cx = width / 2;
        const cy = height / 2;
        const rx = Math.min(width * 0.38, 320);
        const ry = Math.min(height * 0.38, 220);

        const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const total = nodeIds.length;

        nodeIds.forEach((id, i) => {
            const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * rx;
            const y = cy + Math.sin(angle) * ry;
            g.addNode(id, x, y);
        });

        for (let i = 0; i < total; i++) {
            g.addEdge(nodeIds[i], nodeIds[(i + 1) % total]);
        }

        g.addEdge('B', 'H');
        g.addEdge('B', 'F');
        g.addEdge('C', 'G');
        g.addEdge('D', 'H');

        return g;
    }

    static createRing(width, height) {
        const g = new NetworkGraph();
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.min(width * 0.34, height * 0.34, 250);
        const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        const total = nodeIds.length;

        nodeIds.forEach((id, i) => {
            const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
            g.addNode(id, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            if (i > 0) g.addEdge(nodeIds[i - 1], nodeIds[i]);
        });
        g.addEdge(nodeIds[total - 1], nodeIds[0]);

        return g;
    }

    static createTree(width, height) {
        const g = new NetworkGraph();
        const topY = height * 0.18;
        const midY = height * 0.48;
        const botY = height * 0.78;
        const cx = width / 2;

        g.addNode('A', cx, topY);
        g.addNode('B', cx - width * 0.25, midY);
        g.addNode('C', cx + width * 0.25, midY);
        g.addEdge('A', 'B');
        g.addEdge('A', 'C');

        g.addNode('D', cx - width * 0.35, botY);
        g.addNode('E', cx - width * 0.15, botY);
        g.addNode('F', cx + width * 0.15, botY);
        g.addNode('G', cx + width * 0.35, botY);

        g.addEdge('B', 'D');
        g.addEdge('B', 'E');
        g.addEdge('C', 'F');
        g.addEdge('C', 'G');

        return g;
    }

    static createAdHoc(width, height) {
        const g = new NetworkGraph();
        const cx = width / 2;
        const cy = height / 2;
        const dx = width * 0.22;
        const dy = height * 0.26;

        const positions = [
            { id: 'A', x: cx - dx * 1.5, y: cy - dy * 0.8 },
            { id: 'B', x: cx - dx * 0.5, y: cy - dy * 1.1 },
            { id: 'C', x: cx + dx * 0.6, y: cy - dy * 0.9 },
            { id: 'D', x: cx + dx * 1.6, y: cy - dy * 0.6 },
            { id: 'E', x: cx - dx * 1.2, y: cy + dy * 0.9 },
            { id: 'F', x: cx - dx * 0.1, y: cy + dy * 0.7 },
            { id: 'G', x: cx + dx * 0.9, y: cy + dy * 1.1 },
            { id: 'H', x: cx + dx * 1.5, y: cy + dy * 0.7 }
        ];

        positions.forEach(p => g.addNode(p.id, p.x, p.y));

        g.addEdge('A', 'B');
        g.addEdge('A', 'E');
        g.addEdge('B', 'C');
        g.addEdge('B', 'F');
        g.addEdge('C', 'D');
        g.addEdge('C', 'F');
        g.addEdge('C', 'G');
        g.addEdge('D', 'H');
        g.addEdge('E', 'F');
        g.addEdge('F', 'G');
        g.addEdge('G', 'H');

        return g;
    }
}

// ============================================================================
// 1.5. Graph Layout Engine (Automatic Node Placement with Visual Clarity)
// ============================================================================

class GraphLayoutEngine {
    /**
     * Force-Directed layout using Fruchterman-Reingold with collision protection,
     * center gravity, boundary soft-springs, and simulated annealing cooling.
     */
    static computeForceDirected(graph, width, height, options = {}) {
        const padding = options.padding || 70;
        const iterations = options.iterations || 140;
        const usableW = Math.max(200, width - padding * 2);
        const usableH = Math.max(200, height - padding * 2);
        const cx = width / 2;
        const cy = height / 2;

        const nodes = Array.from(graph.nodes.values());
        const n = nodes.length;
        if (n === 0) return new Map();
        if (n === 1) {
            const pos = new Map();
            pos.set(nodes[0].id, { x: cx, y: cy });
            return pos;
        }

        // Optimal distance k based on usable canvas area and node count
        const area = usableW * usableH;
        const k = Math.min(220, Math.max(90, Math.sqrt(area / n) * 0.95));
        const k2 = k * k;

        // Current working positions
        const pos = new Map();
        nodes.forEach(node => {
            let x = Number.isFinite(node.x) ? node.x : (cx + (Math.random() - 0.5) * 100);
            let y = Number.isFinite(node.y) ? node.y : (cy + (Math.random() - 0.5) * 100);
            pos.set(node.id, { x, y });
        });

        // Initial temperature
        let temp = Math.min(usableW, usableH) * 0.28;
        const minTemp = 1.0;
        const cooling = Math.pow(minTemp / temp, 1.0 / iterations);

        const minNodeDist = 75; // Radius * 2 + safety margin for labels

        for (let iter = 0; iter < iterations; iter++) {
            const forces = new Map();
            nodes.forEach(node => forces.set(node.id, { fx: 0, fy: 0 }));

            // 1. Coulomb Repulsion between all node pairs
            for (let i = 0; i < n; i++) {
                const u = nodes[i];
                const pU = pos.get(u.id);
                for (let j = i + 1; j < n; j++) {
                    const v = nodes[j];
                    const pV = pos.get(v.id);

                    let dx = pU.x - pV.x;
                    let dy = pU.y - pV.y;
                    let d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 0.1) {
                        dx = (Math.random() - 0.5) || 1;
                        dy = (Math.random() - 0.5) || 1;
                        d = Math.sqrt(dx * dx + dy * dy);
                    }

                    // Standard repulsive force: k^2 / d
                    let f = k2 / d;

                    // Extra collision barrier for visual clarity
                    if (d < minNodeDist) {
                        const overlap = (minNodeDist - d);
                        f += (overlap * overlap) * 2.8;
                    }

                    const fx = (dx / d) * f;
                    const fy = (dy / d) * f;

                    const fU = forces.get(u.id);
                    const fV = forces.get(v.id);
                    fU.fx += fx;
                    fU.fy += fy;
                    fV.fx -= fx;
                    fV.fy -= fy;
                }
            }

            // 2. Hooke's Spring Attraction along connected edges
            for (const edge of graph.edges) {
                const pU = pos.get(edge.u);
                const pV = pos.get(edge.v);
                if (!pU || !pV) continue;

                const dx = pU.x - pV.x;
                const dy = pU.y - pV.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 0.1) continue;

                // Attractive force: d^2 / k
                const f = (d * d) / k;
                const fx = (dx / d) * f;
                const fy = (dy / d) * f;

                const fU = forces.get(edge.u);
                const fV = forces.get(edge.v);
                fU.fx -= fx;
                fU.fy -= fy;
                fV.fx += fx;
                fV.fy += fy;
            }

            // 3. Center Gravity: Pull gently toward canvas center
            const gravityCoeff = 0.07;
            nodes.forEach(node => {
                const p = pos.get(node.id);
                const f = forces.get(node.id);
                f.fx += (cx - p.x) * gravityCoeff;
                f.fy += (cy - p.y) * gravityCoeff;
            });

            // 4. Boundary Cushion Repulsion
            const edgeThreshold = padding + 40;
            nodes.forEach(node => {
                const p = pos.get(node.id);
                const f = forces.get(node.id);

                if (p.x < edgeThreshold) {
                    f.fx += Math.pow(edgeThreshold - p.x, 2) * 0.18;
                } else if (p.x > width - edgeThreshold) {
                    f.fx -= Math.pow(p.x - (width - edgeThreshold), 2) * 0.18;
                }

                if (p.y < edgeThreshold) {
                    f.fy += Math.pow(edgeThreshold - p.y, 2) * 0.18;
                } else if (p.y > height - edgeThreshold) {
                    f.fy -= Math.pow(p.y - (height - edgeThreshold), 2) * 0.18;
                }
            });

            // 5. Apply displacements limited by temperature
            nodes.forEach(node => {
                const p = pos.get(node.id);
                const f = forces.get(node.id);

                const fLen = Math.sqrt(f.fx * f.fx + f.fy * f.fy);
                if (fLen > 0.001) {
                    const step = Math.min(fLen, temp);
                    p.x += (f.fx / fLen) * step;
                    p.y += (f.fy / fLen) * step;
                }

                // Strict clamp to viewport bounds with padding
                p.x = Math.max(padding, Math.min(width - padding, p.x));
                p.y = Math.max(padding, Math.min(height - padding, p.y));
            });

            temp *= cooling;
        }

        return pos;
    }

    /**
     * Flow / Hierarchical Layout from Source to Destination:
     * Levels computed by shortest hop distance from Source.
     * Horizontal rank ordering with barycentric crossing reduction.
     */
    static computeFlowLayout(graph, width, height, sourceId, destId, options = {}) {
        const padding = options.padding || 75;
        const usableW = width - padding * 2;
        const usableH = height - padding * 2;
        const cy = height / 2;

        const nodes = Array.from(graph.nodes.values());
        if (nodes.length === 0) return new Map();

        const nodeIds = nodes.map(n => n.id);
        const startId = (sourceId && graph.nodes.has(sourceId)) ? sourceId : nodeIds[0];

        // BFS to assign hop levels from Source
        const levels = new Map();
        const queue = [startId];
        levels.set(startId, 0);

        while (queue.length > 0) {
            const curr = queue.shift();
            const currLvl = levels.get(curr);
            const neighbors = graph.getNeighbors(curr);
            for (const nbr of neighbors) {
                if (!levels.has(nbr)) {
                    levels.set(nbr, currLvl + 1);
                    queue.push(nbr);
                }
            }
        }

        // Handle disconnected nodes
        let maxLvl = 0;
        levels.forEach(lvl => { if (lvl > maxLvl) maxLvl = lvl; });
        nodes.forEach(n => {
            if (!levels.has(n.id)) {
                maxLvl++;
                levels.set(n.id, maxLvl);
            }
        });

        // Group nodes by level
        const levelGroups = new Map();
        for (let i = 0; i <= maxLvl; i++) levelGroups.set(i, []);
        levels.forEach((lvl, id) => {
            levelGroups.get(lvl).push(id);
        });

        const pos = new Map();
        const numCols = maxLvl + 1;
        const colStep = numCols > 1 ? (usableW / (numCols - 1)) : 0;

        for (let l = 0; l <= maxLvl; l++) {
            const group = levelGroups.get(l);
            const x = numCols > 1 ? (padding + l * colStep) : (width / 2);

            // Sort nodes within level by average Y of previous-level neighbors (barycentric heuristic)
            if (l > 0) {
                group.sort((a, b) => {
                    const avgYA = GraphLayoutEngine._getAvgNeighborY(a, pos, graph);
                    const avgYB = GraphLayoutEngine._getAvgNeighborY(b, pos, graph);
                    return avgYA - avgYB;
                });
            }

            const count = group.length;
            const rowStep = Math.min(105, count > 1 ? (usableH / (count - 1)) : 0);
            const startY = cy - ((count - 1) * rowStep) / 2;

            group.forEach((id, idx) => {
                const y = count === 1 ? cy : (startY + idx * rowStep);
                pos.set(id, {
                    x: Math.round(x),
                    y: Math.round(Math.max(padding, Math.min(height - padding, y)))
                });
            });
        }

        return pos;
    }

    /**
     * Circular Layout: Places nodes equidistant along an ellipse.
     */
    static computeCircularLayout(graph, width, height, options = {}) {
        const padding = options.padding || 75;
        const cx = width / 2;
        const cy = height / 2;
        const rx = Math.max(120, (width - padding * 2) * 0.44);
        const ry = Math.max(100, (height - padding * 2) * 0.44);

        const nodes = Array.from(graph.nodes.values());
        const total = nodes.length;
        const pos = new Map();
        if (total === 0) return pos;

        nodes.forEach((node, i) => {
            const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
            pos.set(node.id, {
                x: Math.round(cx + Math.cos(angle) * rx),
                y: Math.round(cy + Math.sin(angle) * ry)
            });
        });

        return pos;
    }

    /**
     * Orthogonal Grid Matrix Layout.
     */
    static computeGridLayout(graph, width, height, options = {}) {
        const padding = options.padding || 75;
        const usableW = width - padding * 2;
        const usableH = height - padding * 2;
        const nodes = Array.from(graph.nodes.values());
        const total = nodes.length;
        const pos = new Map();
        if (total === 0) return pos;

        const cols = Math.ceil(Math.sqrt(total * (usableW / usableH)));
        const rows = Math.ceil(total / cols);

        const colStep = cols > 1 ? (usableW / (cols - 1)) : 0;
        const rowStep = rows > 1 ? (usableH / (rows - 1)) : 0;

        nodes.forEach((node, idx) => {
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            const x = cols > 1 ? (padding + c * colStep) : (width / 2);
            const y = rows > 1 ? (padding + r * rowStep) : (height / 2);
            pos.set(node.id, { x: Math.round(x), y: Math.round(y) });
        });

        return pos;
    }

    /**
     * Smart positioning for newly added nodes:
     * Finds the coordinate on the canvas with maximum clearance from existing nodes.
     */
    static findOptimalNewNodePosition(graph, width, height, padding = 80) {
        const nodes = Array.from(graph.nodes.values());
        const cx = width / 2;
        const cy = height / 2;
        if (nodes.length === 0) return { x: cx, y: cy };

        const step = 40;
        let bestDist = -1;
        let bestPos = { x: cx, y: cy };

        for (let x = padding; x <= width - padding; x += step) {
            for (let y = padding; y <= height - padding; y += step) {
                let minDist = Infinity;
                for (const node of nodes) {
                    const dx = x - node.x;
                    const dy = y - node.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < minDist) minDist = d;
                }
                const distToCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                const score = minDist - (distToCenter * 0.15);

                if (score > bestDist) {
                    bestDist = score;
                    bestPos = { x, y };
                }
            }
        }

        return bestPos;
    }

    static _getAvgNeighborY(nodeId, posMap, graph) {
        const nbrs = graph.getNeighbors(nodeId);
        let sum = 0, count = 0;
        nbrs.forEach(nid => {
            if (posMap.has(nid)) {
                sum += posMap.get(nid).y;
                count++;
            }
        });
        return count > 0 ? (sum / count) : 0;
    }
}

// ============================================================================
// 2. DSR Protocol Simulation Engine
// ============================================================================

class DSREngine {
    /**
     * Simulates DSR execution step-by-step:
     * 1. Cache Check: Does source already have route?
     * 2. If not, RREQ Route Discovery via controlled flooding.
     * 3. Once destination (or cached node) is found, RREP unicasts back.
     * 4. Source-routed DATA delivery along established path.
     */
    static runSimulation(graph, sourceId, destId, maxHops = 6, useCache = true, existingCaches = {}, broadcastMode = 'all') {
        const rounds = [];
        const nodeIds = Array.from(graph.nodes.keys());
        
        // Deep copy existing persistent route caches or initialize
        const nodeCaches = {};
        const nodeSeenRREQs = {};
        for (const id of nodeIds) {
            nodeCaches[id] = existingCaches[id] ? JSON.parse(JSON.stringify(existingCaches[id])) : [];
            nodeSeenRREQs[id] = new Set();
        }

        const initialNodeStates = {};
        for (const id of nodeIds) {
            initialNodeStates[id] = {
                id,
                state: id === sourceId ? 'source' : (id === destId ? 'dest' : 'idle'),
                role: id === sourceId ? 'source' : (id === destId ? 'dest' : 'normal'),
                cache: nodeCaches[id],
                seenRREQs: Array.from(nodeSeenRREQs[id])
            };
        }

        const stats = {
            rreqCount: 0,
            rrepCount: 0,
            dataHops: 0,
            totalMsgs: 0,
            routePath: null,
            deliveryStatus: 'Pending',
            activeRouteNodes: []
        };

        let roundNum = 0;

        // Check if Source has cached route to Dest
        let cachedRouteEntry = null;
        if (useCache) {
            cachedRouteEntry = nodeCaches[sourceId].find(r => r.dest === destId);
        }

        // Round 0: Preparation
        rounds.push({
            roundNumber: 0,
            phase: cachedRouteEntry ? 'Phase 3: DATA Delivery (Cache Hit)' : 'Phase 1: RREQ Route Discovery',
            summary: `Initial State: Source [${sourceId}] wants to deliver DATA to Destination [${destId}].`,
            nodeStates: JSON.parse(JSON.stringify(initialNodeStates)),
            transmissions: [],
            events: [{
                type: 'cache',
                nodeId: sourceId,
                text: cachedRouteEntry 
                    ? `🎯 Route Cache Hit at Source <strong>${sourceId}</strong>: Found route <span class="code-ref">[${cachedRouteEntry.path.join(' → ')}]</span>. Skipping RREQ discovery!`
                    : `Source <strong>${sourceId}</strong> has no cached route to <strong>${destId}</strong>. Initiating RREQ Route Discovery.`
            }],
            stats: { ...stats }
        });

        let discoveredRoute = null;

        if (cachedRouteEntry) {
            discoveredRoute = cachedRouteEntry.path;
            stats.routePath = discoveredRoute.join(' → ');
            stats.activeRouteNodes = [...discoveredRoute];
        } else {
            // PHASE 1: RREQ FLOODING
            let rreqQueue = [];
            const rreqId = `RREQ#1`;
            nodeSeenRREQs[sourceId].add(rreqId);

            // Source broadcasts RREQ to neighbors
            const srcNeighbors = graph.getNeighbors(sourceId);
            srcNeighbors.forEach(nb => {
                rreqQueue.push({
                    type: 'RREQ',
                    from: sourceId,
                    to: nb,
                    src: sourceId,
                    dest: destId,
                    id: rreqId,
                    routeRecord: [sourceId, nb],
                    ttl: maxHops - 1
                });
                stats.rreqCount++;
                stats.totalMsgs++;
            });

            let rreqRound = 1;
            let currentStates = JSON.parse(JSON.stringify(initialNodeStates));

            while (rreqQueue.length > 0 && !discoveredRoute && rreqRound <= 15) {
                const roundTx = [...rreqQueue];
                const nextQueue = [];
                const roundEvents = [];
                const nextStates = JSON.parse(JSON.stringify(currentStates));

                roundTx.forEach(tx => {
                    if (nextStates[tx.from].state === 'idle') {
                        nextStates[tx.from].state = 'rreq-forward';
                    }
                });

                // 1. Group active transmissions by sender (matches in-flight animation on canvas)
                const senderMap = new Map();
                roundTx.forEach(t => {
                    if (!senderMap.has(t.from)) senderMap.set(t.from, []);
                    senderMap.get(t.from).push(t.to);
                });

                senderMap.forEach((targets, sender) => {
                    const isSource = (sender === sourceId);
                    const modeLabel = (broadcastMode === 'all') ? ' across all incident links' : '';
                    roundEvents.push({
                        type: 'rreq',
                        nodeId: sender,
                        text: isSource
                            ? `📤 <strong>Source RREQ Broadcast:</strong> Node <strong>${sender}</strong> broadcasts Route Request${modeLabel} to neighbors [${targets.join(', ')}].`
                            : `📤 <strong>RREQ Flooding in Flight:</strong> Node <strong>${sender}</strong> broadcasts RREQ${modeLabel} to [${targets.join(', ')}].`
                    });
                });

                for (const pkt of roundTx) {
                    const receiverId = pkt.to;
                    const receiver = nextStates[receiverId];

                    // Check if receiver is destination
                    if (receiverId === destId) {
                        if (!discoveredRoute) {
                            discoveredRoute = pkt.routeRecord;
                            stats.routePath = discoveredRoute.join(' → ');
                            stats.activeRouteNodes = [...discoveredRoute];
                            receiver.state = 'dest-received';

                            roundEvents.push({
                                type: 'rreq',
                                nodeId: receiverId,
                                text: `🎯 <strong>RREQ Reached Destination:</strong> Destination Node <strong>${destId}</strong> received RREQ from <strong>${pkt.from}</strong> via path <span class="code-ref">[${pkt.routeRecord.join(' → ')}]</span>. Route found!`
                            });
                        } else {
                            roundEvents.push({
                                type: 'duplicate',
                                nodeId: receiverId,
                                text: `⚠️ <strong>Duplicate RREQ at Dest Dropped:</strong> Destination Node <strong>${destId}</strong> received redundant RREQ from <strong>${pkt.from}</strong> via <span class="code-ref">[${pkt.routeRecord.join(' → ')}]</span> → Dropped.`
                            });
                        }
                        continue;
                    }

                    // Duplicate / Loop RREQ check:
                    // 1) Already seen this RREQ ID from this initiator?
                    // 2) Or is this receiver already present in the routeRecord history (routing loop)?
                    const isDuplicate = nodeSeenRREQs[receiverId].has(pkt.id);
                    const isLoop = pkt.routeRecord.slice(0, -1).includes(receiverId);

                    if (isDuplicate || isLoop) {
                        roundEvents.push({
                            type: 'duplicate',
                            nodeId: receiverId,
                            text: isLoop
                                ? `⚠️ <strong>Loop RREQ Dropped:</strong> Node <strong>${receiverId}</strong> received RREQ from <strong>${pkt.from}</strong>, but is already in Route Record <span class="code-ref">[${pkt.routeRecord.join(' → ')}]</span> → Dropped.`
                                : `⚠️ <strong>Duplicate RREQ Dropped:</strong> Node <strong>${receiverId}</strong> received redundant RREQ from <strong>${pkt.from}</strong>. Already processed #${pkt.id} → Dropped.`
                        });
                        continue;
                    }
                    nodeSeenRREQs[receiverId].add(pkt.id);
                    receiver.seenRREQs = Array.from(nodeSeenRREQs[receiverId]);

                    // TTL check
                    if (pkt.ttl <= 1) {
                        roundEvents.push({
                            type: 'duplicate',
                            nodeId: receiverId,
                            text: `🛑 <strong>RREQ Hop Limit:</strong> RREQ reached Node <strong>${receiverId}</strong> with TTL = 1 → Hop limit reached, discarded.`
                        });
                        continue;
                    }

                    // Snoop and cache reverse route to source!
                    const pathToSrc = [...pkt.routeRecord].reverse();
                    if (!nodeCaches[receiverId].some(c => c.dest === sourceId)) {
                        nodeCaches[receiverId].push({
                            dest: sourceId,
                            path: pathToSrc,
                            hops: pathToSrc.length - 1,
                            learnedVia: 'RREQ Snooping'
                        });
                        receiver.cache = nodeCaches[receiverId];
                    }

                    // Intermediate node forwards RREQ to neighbors across all directions (or filtered if mode is filtered)
                    const neighbors = graph.getNeighbors(receiverId);
                    const forwardTargets = (broadcastMode === 'all')
                        ? neighbors
                        : neighbors.filter(n => !pkt.routeRecord.includes(n));

                    if (forwardTargets.length > 0) {
                        forwardTargets.forEach(target => {
                            nextQueue.push({
                                type: 'RREQ',
                                from: receiverId,
                                to: target,
                                src: sourceId,
                                dest: destId,
                                id: pkt.id,
                                routeRecord: [...pkt.routeRecord, target],
                                ttl: pkt.ttl - 1
                            });
                            stats.rreqCount++;
                            stats.totalMsgs++;
                        });

                        const modeNotice = (broadcastMode === 'all') ? ' across all directions' : '';
                        roundEvents.push({
                            type: 'rreq',
                            nodeId: receiverId,
                            text: `📥 <strong>RREQ Accepted & Snooped:</strong> Node <strong>${receiverId}</strong> cached reverse route to ${sourceId}, appended self to header <span class="code-ref">[${[...pkt.routeRecord].join(' → ')}]</span>, and queued RREQ broadcast${modeNotice} to [${forwardTargets.join(', ')}] for Step ${rreqRound + 1}.`
                        });
                    } else {
                        roundEvents.push({
                            type: 'rreq',
                            nodeId: receiverId,
                            text: `📥 <strong>RREQ Accepted (Dead End):</strong> Node <strong>${receiverId}</strong> cached reverse route to ${sourceId}, but has no other neighbors to forward to.`
                        });
                    }
                }

                roundNum++;
                const sendersList = Array.from(senderMap.keys()).join(', ');
                const receiversList = Array.from(new Set(roundTx.map(t => t.to))).join(', ');

                rounds.push({
                    roundNumber: roundNum,
                    phase: 'Phase 1: RREQ Route Discovery',
                    summary: `RREQ Flooding Step ${rreqRound}: ${roundTx.length} packet(s) in flight (${sendersList} → ${receiversList})`,
                    nodeStates: JSON.parse(JSON.stringify(nextStates)),
                    transmissions: roundTx,
                    events: roundEvents,
                    stats: { ...stats }
                });

                currentStates = nextStates;
                rreqQueue = nextQueue;
                rreqRound++;
            }

            // If destination was found, initiate PHASE 2: RREP (Unicast Reverse Path)
            if (discoveredRoute) {
                const reversedPath = [...discoveredRoute].reverse(); // e.g. [D, ..., S]

                // Hop by hop unicast RREP
                for (let i = 0; i < reversedPath.length - 1; i++) {
                    const fromNode = reversedPath[i];
                    const toNode = reversedPath[i + 1];
                    roundNum++;

                    const nextStates = JSON.parse(JSON.stringify(currentStates));
                    nextStates[fromNode].state = 'rrep-reply';
                    nextStates[toNode].state = 'rrep-reply';

                    // Update Route Cache for this node
                    const forwardPath = discoveredRoute.slice(discoveredRoute.indexOf(toNode));
                    if (!nodeCaches[toNode].some(c => c.dest === destId)) {
                        nodeCaches[toNode].push({
                            dest: destId,
                            path: forwardPath,
                            hops: forwardPath.length - 1,
                            learnedVia: 'RREP Response'
                        });
                        nextStates[toNode].cache = nodeCaches[toNode];
                    }

                    stats.rrepCount++;
                    stats.totalMsgs++;

                    const isFinalHop = (toNode === sourceId);
                    const rrepEventText = isFinalHop
                        ? `📨 <strong>RREP Arrived at Source:</strong> Node <strong>${fromNode}</strong> delivered Route Reply to Source <strong>${toNode}</strong>. Full route <span class="code-ref">[${discoveredRoute.join(' → ')}]</span> saved in Source Cache!`
                        : `📨 <strong>RREP Unicast in Flight:</strong> Node <strong>${fromNode}</strong> unicasts Route Reply to next hop <strong>${toNode}</strong> along reverse path <span class="code-ref">[${reversedPath.join(' → ')}]</span>.`;

                    rounds.push({
                        roundNumber: roundNum,
                        phase: 'Phase 2: Route Reply (RREP)',
                        summary: `RREP Unicast: Node ${fromNode} → ${toNode}`,
                        nodeStates: JSON.parse(JSON.stringify(nextStates)),
                        transmissions: [{
                            type: 'RREP',
                            from: fromNode,
                            to: toNode,
                            route: discoveredRoute
                        }],
                        events: [{
                            type: 'rrep',
                            nodeId: fromNode,
                            text: rrepEventText
                        }],
                        stats: { ...stats }
                    });

                    currentStates = nextStates;
                }

                // Install route at source
                if (!nodeCaches[sourceId].some(c => c.dest === destId)) {
                    nodeCaches[sourceId].push({
                        dest: destId,
                        path: discoveredRoute,
                        hops: discoveredRoute.length - 1,
                        learnedVia: 'RREP Discovered'
                    });
                    currentStates[sourceId].cache = nodeCaches[sourceId];
                }
            }
        }

        // PHASE 3: SOURCE ROUTED DATA DELIVERY
        if (discoveredRoute) {
            for (let i = 0; i < discoveredRoute.length - 1; i++) {
                const fromNode = discoveredRoute[i];
                const toNode = discoveredRoute[i + 1];
                roundNum++;

                const nextStates = JSON.parse(JSON.stringify(initialNodeStates));
                // Highlight active route path
                discoveredRoute.forEach(id => {
                    nextStates[id].state = 'path-active';
                });
                nextStates[fromNode].state = 'data-transmit';
                nextStates[toNode].state = (toNode === destId) ? 'delivered' : 'data-receive';
                const isDelivered = (toNode === destId);
                const dataEventText = isDelivered
                    ? `🎉 <strong>DATA Payload Delivered!</strong> Destination <strong>${destId}</strong> received payload from <strong>${fromNode}</strong> via strict source route <span class="code-ref">[${discoveredRoute.join(' → ')}]</span>.`
                    : `🚀 <strong>Source-Routed DATA in Flight:</strong> Node <strong>${fromNode}</strong> transmits payload across link to next designated hop <strong>${toNode}</strong> as specified in route header.`;

                stats.dataHops++;
                stats.totalMsgs++;
                if (toNode === destId) {
                    stats.deliveryStatus = 'Delivered 🎉';
                }

                rounds.push({
                    roundNumber: roundNum,
                    phase: 'Phase 3: Source-Routed DATA Delivery',
                    summary: `DATA Transit (Hop ${i + 1}): ${fromNode} → ${toNode}`,
                    nodeStates: JSON.parse(JSON.stringify(nextStates)),
                    transmissions: [{
                        type: 'DATA',
                        from: fromNode,
                        to: toNode,
                        fullPath: discoveredRoute,
                        currentHop: i + 1
                    }],
                    events: [{
                        type: 'data',
                        nodeId: fromNode,
                        text: (toNode === destId)
                            ? `🎉 <strong>DATA Delivered!</strong> Destination <strong>${destId}</strong> received payload via strict source route <span class="code-ref">[${discoveredRoute.join(' → ')}]</span>.`
                            : `🚀 Node <strong>${fromNode}</strong> forwarded DATA packet to next hop <strong>${toNode}</strong> as specified in packet header.`
                    }],
                    stats: { ...stats }
                });
            }
        } else {
            stats.deliveryStatus = 'Route Discovery Failed';
            rounds[rounds.length - 1].events.push({
                type: 'duplicate',
                nodeId: sourceId,
                text: `❌ Could not find a route from <strong>${sourceId}</strong> to <strong>${destId}</strong> within hop limit.`
            });
        }

        return { rounds, updatedCaches: nodeCaches };
    }
}

// ============================================================================
// 3. Canvas Renderer for DSR
// ============================================================================

class DSRRenderer {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;

        this.draggedNode = null;
        this.hoveredNode = null;
        this.selectedNodeId = null;
        this.connectSourceNode = null;
        this.isConnectMode = false;
        this.isEditMode = false;

        this.activeTransmissions = [];
        this.packetProgress = 1.0;
        this.pulseTime = 0;
        this.activeRouteNodes = [];
        this.nodeTransitionRaf = null;

        this.setupDPI();
        this.bindEvents();
    }

    setupDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const parent = this.canvas.parentElement;
        const w = rect.width || (parent ? parent.clientWidth : 800) || 800;
        const h = rect.height || (parent ? parent.clientHeight : 550) || 550;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        this.width = w;
        this.height = h;
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.setupDPI();
            this.draw();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.nodeTransitionRaf) {
                cancelAnimationFrame(this.nodeTransitionRaf);
                this.nodeTransitionRaf = null;
            }

            const pos = this.getMousePos(e);
            const node = this.getNodeAt(pos.x, pos.y);

            if (this.isConnectMode && node) {
                if (!this.connectSourceNode) {
                    this.connectSourceNode = node;
                } else {
                    if (this.connectSourceNode.id !== node.id) {
                        if (this.graph.hasEdge(this.connectSourceNode.id, node.id)) {
                            this.graph.removeEdge(this.connectSourceNode.id, node.id);
                        } else {
                            this.graph.addEdge(this.connectSourceNode.id, node.id);
                        }
                        if (window.app) window.app.onGraphStructureChanged();
                    }
                    this.connectSourceNode = null;
                }
                this.draw();
                return;
            }

            if (node) {
                this.draggedNode = node;
                this.dragOffset = { x: pos.x - node.x, y: pos.y - node.y };
                this.selectedNodeId = node.id;
                if (window.app) window.app.onNodeSelected(node.id);
            } else if (this.isEditMode) {
                const nextLetter = this.getNextNodeId();
                if (nextLetter) {
                    this.graph.addNode(nextLetter, pos.x, pos.y);
                    if (window.app) window.app.onGraphStructureChanged();
                    this.draw();
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const pos = this.getMousePos(e);
            if (this.draggedNode) {
                this.draggedNode.x = Math.max(30, Math.min(this.width - 30, pos.x - this.dragOffset.x));
                this.draggedNode.y = Math.max(30, Math.min(this.height - 30, pos.y - this.dragOffset.y));
                this.draw();
            } else {
                const node = this.getNodeAt(pos.x, pos.y);
                if (this.hoveredNode !== node) {
                    this.hoveredNode = node;
                    this.canvas.style.cursor = node ? 'pointer' : (this.isEditMode ? 'crosshair' : 'default');
                    this.draw();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedNode) {
                this.draggedNode = null;
                this.draw();
            }
        });
    }

    getNextNodeId() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const char of letters) {
            if (!this.graph.nodes.has(char)) return char;
        }
        return null;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getNodeAt(x, y) {
        for (const node of this.graph.nodes.values()) {
            const dx = node.x - x;
            const dy = node.y - y;
            if (Math.hypot(dx, dy) <= node.radius + 6) return node;
        }
        return null;
    }

    setSimulationState(roundData, packetProgress = 1.0) {
        this.currentRound = roundData;
        this.packetProgress = packetProgress;
        this.activeTransmissions = roundData ? roundData.transmissions : [];
        this.activeRouteNodes = (roundData && roundData.stats && roundData.stats.activeRouteNodes) 
            ? roundData.stats.activeRouteNodes 
            : ((roundData && roundData.activeRoute) ? roundData.activeRoute : []);
        this.draw();
    }

    /**
     * Smoothly animates node positions from current to target coordinates
     * using cubic ease-out curve.
     */
    transitionNodes(targetPositions, duration = 450, onComplete = null) {
        if (this.nodeTransitionRaf) {
            cancelAnimationFrame(this.nodeTransitionRaf);
            this.nodeTransitionRaf = null;
        }

        const startPositions = new Map();
        this.graph.nodes.forEach(node => {
            startPositions.set(node.id, { x: node.x, y: node.y });
        });

        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            const rawProgress = Math.min(1.0, elapsed / duration);
            // Ease-out cubic
            const progress = 1 - Math.pow(1 - rawProgress, 3);

            this.graph.nodes.forEach(node => {
                const start = startPositions.get(node.id);
                const target = targetPositions.get(node.id);
                if (start && target) {
                    node.x = start.x + (target.x - start.x) * progress;
                    node.y = start.y + (target.y - start.y) * progress;
                }
            });

            this.draw();

            if (rawProgress < 1.0) {
                this.nodeTransitionRaf = requestAnimationFrame(animate);
            } else {
                this.nodeTransitionRaf = null;
                if (onComplete) onComplete();
            }
        };

        this.nodeTransitionRaf = requestAnimationFrame(animate);
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        this.pulseTime += 0.05;

        this.drawGrid();
        this.drawEdges();
        if (this.activeTransmissions.length > 0 && this.packetProgress < 1.0) {
            this.drawBroadcastWaves();
            this.drawPackets();
        }
        this.drawNodes();
    }

    drawBroadcastWaves() {
        const ctx = this.ctx;
        const p = Math.min(1.0, Math.max(0.0, this.packetProgress));
        if (p <= 0 || p >= 1.0) return;

        // Radiating 360-degree broadcast waves for active sender nodes transmitting RREQs
        const rreqTransmissions = this.activeTransmissions.filter(t => t.type === 'RREQ');
        const senders = new Set(rreqTransmissions.map(t => t.from));
        if (senders.size === 0) return;

        ctx.save();
        for (const senderId of senders) {
            const node = this.graph.nodes.get(senderId);
            if (!node) continue;

            const maxRadius = 140;
            const rings = 2;
            for (let r = 0; r < rings; r++) {
                const ringOffset = r * 0.4;
                const ringProgress = (p + ringOffset) % 1.0;
                const radius = 20 + ringProgress * maxRadius;
                const alpha = Math.max(0, (1 - ringProgress) * 0.38);

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
                ctx.lineWidth = 1.6;
                ctx.setLineDash([4, 4]);
                ctx.stroke();

                const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
                grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
                grad.addColorStop(1, `rgba(56, 189, 248, ${alpha * 0.22})`);
                ctx.fillStyle = grad;
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        const spacing = 32;
        for (let x = spacing; x < this.width; x += spacing) {
            for (let y = spacing; y < this.height; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawEdges() {
        const ctx = this.ctx;

        for (const edge of this.graph.edges) {
            const u = this.graph.nodes.get(edge.u);
            const v = this.graph.nodes.get(edge.v);
            if (!u || !v) continue;

            const isRouteEdge = this.activeRouteNodes.length > 1 && 
                this.isConsecutiveInRoute(u.id, v.id);

            const isActiveTx = this.activeTransmissions.some(t => 
                (t.from === u.id && t.to === v.id) || (t.from === v.id && t.to === u.id)
            );

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(u.x, u.y);
            ctx.lineTo(v.x, v.y);

            if (isActiveTx) {
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 3.5;
                ctx.shadowColor = 'rgba(192, 132, 252, 0.7)';
                ctx.shadowBlur = 12;
            } else if (isRouteEdge) {
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
                ctx.lineWidth = 2.5;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.lineWidth = 2;
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    isConsecutiveInRoute(id1, id2) {
        for (let i = 0; i < this.activeRouteNodes.length - 1; i++) {
            if ((this.activeRouteNodes[i] === id1 && this.activeRouteNodes[i+1] === id2) ||
                (this.activeRouteNodes[i] === id2 && this.activeRouteNodes[i+1] === id1)) {
                return true;
            }
        }
        return false;
    }

    drawPackets() {
        const ctx = this.ctx;
        const p = Math.min(1.0, Math.max(0.0, this.packetProgress));

        for (const tx of this.activeTransmissions) {
            const from = this.graph.nodes.get(tx.from);
            const to = this.graph.nodes.get(tx.to);
            if (!from || !to) continue;

            const curX = from.x + (to.x - from.x) * p;
            const curY = from.y + (to.y - from.y) * p;

            ctx.save();

            let color = '#38bdf8'; // RREQ default cyan
            let badgeText = 'RREQ';

            if (tx.type === 'RREP') {
                color = '#d946ef'; // Magenta
                badgeText = 'RREP';
            } else if (tx.type === 'DATA') {
                color = '#10b981'; // Emerald
                badgeText = 'DATA';
            }

            ctx.shadowColor = color;
            ctx.shadowBlur = 16;

            ctx.beginPath();
            ctx.arc(curX, curY, 11, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, curX, curY);

            ctx.restore();
        }
    }

    drawNodes() {
        const ctx = this.ctx;
        const nodeStates = this.currentRound ? this.currentRound.nodeStates : null;

        for (const node of this.graph.nodes.values()) {
            const nodeData = nodeStates ? nodeStates[node.id] : null;
            const state = nodeData ? nodeData.state : 'idle';
            const isHovered = this.hoveredNode === node;
            const isSelected = this.selectedNodeId === node.id;
            const isConnectSource = this.connectSourceNode === node;
            const isInActiveRoute = this.activeRouteNodes.includes(node.id);

            ctx.save();

            let fillColor = '#1e293b';
            let strokeColor = '#475569';
            let glowColor = 'transparent';
            let glowBlur = 0;

            if (state === 'source') {
                fillColor = '#0c4a6e';
                strokeColor = '#00f2fe';
                glowColor = 'rgba(0, 242, 254, 0.7)';
                glowBlur = 20;
            } else if (state === 'dest' || state === 'dest-received') {
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                glowColor = 'rgba(16, 185, 129, 0.7)';
                glowBlur = 20;
            } else if (state === 'rreq-forward') {
                fillColor = '#1e293b';
                strokeColor = '#38bdf8';
                glowColor = 'rgba(56, 189, 248, 0.5)';
                glowBlur = 14;
            } else if (state === 'rrep-reply') {
                fillColor = '#4a044e';
                strokeColor = '#d946ef';
                glowColor = 'rgba(217, 70, 239, 0.7)';
                glowBlur = 18;
            } else if (state === 'data-transmit' || state === 'data-receive') {
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                glowColor = 'rgba(16, 185, 129, 0.8)';
                glowBlur = 22;
            } else if (state === 'delivered') {
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                glowColor = 'rgba(16, 185, 129, 0.9)';
                glowBlur = 26;
            } else if (isInActiveRoute) {
                strokeColor = '#c084fc';
            }

            if (isSelected) strokeColor = '#ffffff';

            if (state === 'source' || state === 'dest-received' || state === 'data-transmit') {
                const pulseRadius = node.radius + 6 + (Math.sin(this.pulseTime) + 1) * 4;
                ctx.beginPath();
                ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            ctx.shadowColor = glowColor;
            ctx.shadowBlur = glowBlur;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();

            ctx.lineWidth = isSelected ? 3.5 : (isHovered ? 2.8 : 2);
            ctx.strokeStyle = isConnectSource ? '#f59e0b' : strokeColor;
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y);

            // Small badge for Route Cache count
            if (nodeData && nodeData.cache && nodeData.cache.length > 0) {
                ctx.beginPath();
                ctx.arc(node.x + node.radius * 0.7, node.y - node.radius * 0.7, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#a855f7';
                ctx.fill();
                ctx.font = '700 8.5px "JetBrains Mono", monospace';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(nodeData.cache.length, node.x + node.radius * 0.7, node.y - node.radius * 0.7);
            }

            ctx.restore();
        }
    }
}

// ============================================================================
// 4. Playback Controller & UI Integration for DSR
// ============================================================================

class DSRSimulationController {
    constructor() {
        this.graph = null;
        this.renderer = null;
        this.simulationRounds = [];
        this.currentRoundIndex = 0;
        this.persistentRouteCaches = {}; // node -> [{ dest, path, hops, learnedVia }]

        this.isPlaying = false;
        this.speedMultiplier = 1.0;
        this.baseRoundDuration = 1200;
        this.animationTimer = null;

        // UI Controls
        this.sourceSelect = document.getElementById('source-select');
        this.destSelect = document.getElementById('dest-select');
        this.ttlSlider = document.getElementById('ttl-slider');
        this.ttlValueChip = document.getElementById('ttl-value');
        this.cacheReplyToggle = document.getElementById('cache-reply-toggle');
        this.broadcastModeSelect = document.getElementById('broadcast-mode-select');
        this.topologySelect = document.getElementById('topology-select');
        this.btnStart = document.getElementById('btn-start-simulation');
        this.btnEditMode = document.getElementById('btn-edit-mode');
        this.btnClearCache = document.getElementById('btn-clear-cache');

        // Playback Buttons
        this.btnPlay = document.getElementById('btn-ctrl-play');
        this.btnPrev = document.getElementById('btn-ctrl-prev');
        this.btnNext = document.getElementById('btn-ctrl-next');
        this.btnReset = document.getElementById('btn-ctrl-reset');
        this.timelineSlider = document.getElementById('timeline-slider');
        this.currentRoundText = document.getElementById('current-round-text');
        this.iconPlay = document.getElementById('icon-play');
        this.iconPause = document.getElementById('icon-pause');
        this.speedBtnGroup = document.getElementById('speed-btn-group');

        // Sidebar Elements
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');
        this.sidebarContent = document.querySelector('.sidebar-content');
        this.timelineEventsList = document.getElementById('timeline-events-list');
        this.logCountBadge = document.getElementById('log-count-badge');
        this.inspectorBody = document.getElementById('inspector-body');
        this.inspectorTitle = document.getElementById('inspector-node-title');
        this.inspectorSubtitle = document.getElementById('inspector-node-subtitle');

        // Metrics
        this.metricRreq = document.getElementById('metric-rreq');
        this.metricRrep = document.getElementById('metric-rrep');
        this.metricDataHops = document.getElementById('metric-data-hops');
        this.metricRouteStatus = document.getElementById('metric-route-status');
        this.metricRoutePath = document.getElementById('metric-route-path');
        this.metricTotalMsgs = document.getElementById('metric-total-msgs');
        this.metricDeliveryStatus = document.getElementById('metric-delivery-status');
        this.metricSourceRouteBox = document.getElementById('metric-source-route-box');

        // Status
        this.simStatusText = document.getElementById('sim-status-text');
        this.simStatusBadge = document.getElementById('sim-status-badge');
        this.dsrPhaseName = document.getElementById('dsr-phase-name');
        this.topologyBadgeName = document.getElementById('topology-badge-name');

        // Edit Toolbar
        this.graphEditStrip = document.getElementById('graph-edit-strip');
        this.btnAddNode = document.getElementById('btn-add-node');
        this.btnConnectMode = document.getElementById('btn-connect-mode');
        this.btnClearGraph = document.getElementById('btn-clear-graph');
        this.btnStripAutoLayout = document.getElementById('btn-strip-auto-layout');

        // Layout controls
        this.layoutAlgoSelect = document.getElementById('layout-algo-select');
        this.btnAutoLayout = document.getElementById('btn-auto-layout');

        this.init();
    }

    init() {
        const canvas = document.getElementById('network-canvas');
        const viewport = document.getElementById('canvas-viewport');
        const width = viewport.clientWidth || 800;
        const height = viewport.clientHeight || 550;

        this.graph = NetworkGraph.createMesh(width, height);
        this.renderer = new DSRRenderer(canvas, this.graph);

        this.populateNodeSelects('A', 'G');
        this.bindEvents();
        this.setupContinuousAnimation();
        this.runSimulation();
    }

    bindEvents() {
        this.ttlSlider.addEventListener('input', (e) => {
            this.ttlValueChip.textContent = e.target.value;
            this.runSimulation();
        });

        this.cacheReplyToggle.addEventListener('change', () => this.runSimulation());
        if (this.broadcastModeSelect) {
            this.broadcastModeSelect.addEventListener('change', () => {
                this.runSimulation();
                this.scrollLogToTop(true);
            });
        }
        this.sourceSelect.addEventListener('change', () => this.runSimulation());
        this.destSelect.addEventListener('change', () => this.runSimulation());

        this.topologySelect.addEventListener('change', (e) => {
            this.loadTopology(e.target.value);
        });

        this.btnClearCache.addEventListener('click', () => {
            this.persistentRouteCaches = {};
            this.runSimulation();
            if (this.renderer.selectedNodeId) {
                this.updateInspector(this.renderer.selectedNodeId);
            }
        });

        this.btnStart.addEventListener('click', () => {
            this.runSimulation();
            this.play();
        });

        this.btnPlay.addEventListener('click', () => {
            if (this.isPlaying) this.pause();
            else this.play();
        });

        this.btnNext.addEventListener('click', () => {
            this.pause();
            this.stepForward();
        });

        this.btnPrev.addEventListener('click', () => {
            this.pause();
            this.stepBackward();
        });

        this.btnReset.addEventListener('click', () => {
            this.pause();
            this.goToRound(0);
            this.scrollLogToTop(true);
        });

        this.timelineSlider.addEventListener('input', (e) => {
            this.pause();
            this.goToRound(parseInt(e.target.value, 10));
        });

        this.speedBtnGroup.addEventListener('click', (e) => {
            const pill = e.target.closest('.speed-pill');
            if (!pill) return;
            this.speedBtnGroup.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            this.speedMultiplier = parseFloat(pill.dataset.speed);
        });

        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.tabButtons.forEach(b => b.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });

        this.btnEditMode.addEventListener('click', () => {
            const isEditing = !this.graphEditStrip.classList.contains('hidden');
            if (isEditing) {
                this.graphEditStrip.classList.add('hidden');
                this.btnEditMode.classList.remove('active');
                this.renderer.isEditMode = false;
                this.renderer.isConnectMode = false;
                this.btnConnectMode.classList.remove('active');
            } else {
                this.graphEditStrip.classList.remove('hidden');
                this.btnEditMode.classList.add('active');
                this.renderer.isEditMode = true;
            }
        });

        this.btnAddNode.addEventListener('click', () => {
            const id = this.renderer.getNextNodeId();
            if (id) {
                const optPos = GraphLayoutEngine.findOptimalNewNodePosition(
                    this.graph,
                    this.renderer.width || 800,
                    this.renderer.height || 550
                );
                this.graph.addNode(id, optPos.x, optPos.y);
                this.onGraphStructureChanged();
                this.renderer.draw();

                const infoBox = document.getElementById('quick-info-box');
                if (infoBox) {
                    infoBox.innerHTML = `<span class="quick-title">Node Added:</span> Placed Node <strong>${id}</strong> in clear space. Use 'Connect Nodes' or 'Auto Layout' to arrange.`;
                }
            }
        });

        this.btnConnectMode.addEventListener('click', () => {
            this.renderer.isConnectMode = !this.renderer.isConnectMode;
            this.btnConnectMode.classList.toggle('active', this.renderer.isConnectMode);
            this.renderer.connectSourceNode = null;
        });

        this.btnClearGraph.addEventListener('click', () => {
            this.loadTopology(this.topologySelect.value);
        });

        // Auto Layout triggers
        if (this.btnAutoLayout) {
            this.btnAutoLayout.addEventListener('click', () => this.applyAutoLayout(true));
        }
        if (this.btnStripAutoLayout) {
            this.btnStripAutoLayout.addEventListener('click', () => this.applyAutoLayout(true));
        }
        if (this.layoutAlgoSelect) {
            this.layoutAlgoSelect.addEventListener('change', () => this.applyAutoLayout(true));
        }
    }

    applyAutoLayout(animate = true) {
        if (!this.graph || this.graph.nodes.size === 0) return;

        const algo = this.layoutAlgoSelect ? this.layoutAlgoSelect.value : 'force';
        const w = this.renderer.width || 800;
        const h = this.renderer.height || 550;
        let targetPositions;

        switch (algo) {
            case 'flow':
                targetPositions = GraphLayoutEngine.computeFlowLayout(
                    this.graph, w, h, this.sourceSelect.value, this.destSelect.value
                );
                break;
            case 'circular':
                targetPositions = GraphLayoutEngine.computeCircularLayout(this.graph, w, h);
                break;
            case 'grid':
                targetPositions = GraphLayoutEngine.computeGridLayout(this.graph, w, h);
                break;
            case 'force':
            default:
                targetPositions = GraphLayoutEngine.computeForceDirected(this.graph, w, h);
                break;
        }

        if (animate && this.renderer && this.renderer.transitionNodes) {
            this.renderer.transitionNodes(targetPositions, 450, () => {
                this.renderer.draw();
            });
        } else {
            targetPositions.forEach((pos, id) => {
                const node = this.graph.nodes.get(id);
                if (node) {
                    node.x = pos.x;
                    node.y = pos.y;
                }
            });
            this.renderer.draw();
        }

        const infoBox = document.getElementById('quick-info-box');
        if (infoBox) {
            const algoNames = {
                force: 'Force-Directed (Organic Balanced)',
                flow: 'Hierarchical Flow (Source → Dest)',
                circular: 'Circular / Radial',
                grid: 'Orthogonal Grid'
            };
            infoBox.innerHTML = `<span class="quick-title">Auto-Layout:</span> Organized <strong>${this.graph.nodes.size}</strong> nodes using <strong>${algoNames[algo] || algo}</strong> layout.`;
        }
    }

    scrollLogToTop(smooth = true) {
        const behavior = smooth ? 'smooth' : 'auto';
        if (this.sidebarContent) {
            this.sidebarContent.scrollTo({ top: 0, behavior });
        }
        const sidebarContent = document.querySelector('.sidebar-content');
        if (sidebarContent && sidebarContent !== this.sidebarContent) {
            sidebarContent.scrollTo({ top: 0, behavior });
        }
        if (this.timelineEventsList) this.timelineEventsList.scrollTop = 0;
        if (this.inspectorBody) this.inspectorBody.scrollTop = 0;
    }

    loadTopology(type) {
        const viewport = document.getElementById('canvas-viewport');
        const w = viewport.clientWidth || 800;
        const h = viewport.clientHeight || 550;

        switch (type) {
            case 'mesh':
                this.graph = NetworkGraph.createMesh(w, h);
                this.topologyBadgeName.textContent = 'Mesh (8 Nodes)';
                break;
            case 'ring':
                this.graph = NetworkGraph.createRing(w, h);
                this.topologyBadgeName.textContent = 'Ring (7 Nodes)';
                break;
            case 'tree':
                this.graph = NetworkGraph.createTree(w, h);
                this.topologyBadgeName.textContent = 'Tree / Hierarchy (7 Nodes)';
                break;
            case 'adhoc':
                this.graph = NetworkGraph.createAdHoc(w, h);
                this.topologyBadgeName.textContent = 'Ad-Hoc / Multi-hop (8 Nodes)';
                break;
            case 'custom':
                this.topologyBadgeName.textContent = 'Custom Freehand';
                break;
        }

        this.renderer.graph = this.graph;
        this.populateNodeSelects();
        this.runSimulation();
        this.renderer.draw();
        this.scrollLogToTop(true);
    }

    populateNodeSelects(preferredSrc = null, preferredDest = null) {
        const nodeIds = Array.from(this.graph.nodes.keys());
        const curSrc = preferredSrc || this.sourceSelect.value || nodeIds[0];
        const curDest = preferredDest || this.destSelect.value || nodeIds[nodeIds.length - 1];

        this.sourceSelect.innerHTML = '';
        this.destSelect.innerHTML = '';

        nodeIds.forEach(id => {
            const opt1 = document.createElement('option');
            opt1.value = id;
            opt1.textContent = `Node ${id}`;
            if (id === curSrc) opt1.selected = true;
            this.sourceSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = id;
            opt2.textContent = `Node ${id}`;
            if (id === curDest) opt2.selected = true;
            this.destSelect.appendChild(opt2);
        });

        if (this.sourceSelect.value === this.destSelect.value && nodeIds.length > 1) {
            this.destSelect.selectedIndex = (this.sourceSelect.selectedIndex + 1) % nodeIds.length;
        }
    }

    onGraphStructureChanged() {
        this.populateNodeSelects();
        this.runSimulation();
    }

    onNodeSelected(nodeId) {
        this.updateInspector(nodeId);
        const inspectorTabBtn = document.querySelector('[data-tab="tab-inspector"]');
        if (inspectorTabBtn) inspectorTabBtn.click();
        this.scrollLogToTop(true);
    }

    runSimulation() {
        const src = this.sourceSelect.value;
        const dest = this.destSelect.value;
        const ttl = parseInt(this.ttlSlider.value, 10);
        const useCache = this.cacheReplyToggle.checked;
        const broadcastMode = this.broadcastModeSelect ? this.broadcastModeSelect.value : 'all';

        if (!src || !dest) return;

        const result = DSREngine.runSimulation(
            this.graph,
            src,
            dest,
            ttl,
            useCache,
            this.persistentRouteCaches,
            broadcastMode
        );

        this.simulationRounds = result.rounds;
        this.persistentRouteCaches = result.updatedCaches;

        this.timelineSlider.max = Math.max(0, this.simulationRounds.length - 1);
        this.timelineSlider.disabled = this.simulationRounds.length <= 1;

        this.goToRound(0);
        this.scrollLogToTop(true);
    }

    goToRound(index) {
        if (!this.simulationRounds || this.simulationRounds.length === 0) return;
        this.currentRoundIndex = Math.max(0, Math.min(index, this.simulationRounds.length - 1));
        const roundData = this.simulationRounds[this.currentRoundIndex];

        this.timelineSlider.value = this.currentRoundIndex;
        this.currentRoundText.textContent = `Step ${this.currentRoundIndex} / ${this.simulationRounds.length - 1}`;
        this.dsrPhaseName.textContent = roundData.phase;

        this.renderer.setSimulationState(roundData, 1.0);

        this.updateTimelineUI();
        this.updateMetricsUI(roundData.stats);
        if (this.renderer.selectedNodeId) {
            this.updateInspector(this.renderer.selectedNodeId);
        }
        this.updateStatusBadge(roundData);
    }

    stepForward() {
        if (this.currentRoundIndex < this.simulationRounds.length - 1) {
            this.animateStep(this.currentRoundIndex + 1);
        }
    }

    stepBackward() {
        if (this.currentRoundIndex > 0) {
            this.goToRound(this.currentRoundIndex - 1);
        }
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');

        if (this.currentRoundIndex >= this.simulationRounds.length - 1) {
            this.goToRound(0);
        }

        this.scheduleNextPlayRound();
    }

    pause() {
        this.isPlaying = false;
        this.iconPlay.classList.remove('hidden');
        this.iconPause.classList.add('hidden');
        if (this.animationTimer) {
            cancelAnimationFrame(this.animationTimer);
            this.animationTimer = null;
        }
    }

    scheduleNextPlayRound() {
        if (!this.isPlaying) return;

        if (this.currentRoundIndex >= this.simulationRounds.length - 1) {
            this.pause();
            return;
        }

        const nextIndex = this.currentRoundIndex + 1;
        this.animateStep(nextIndex, () => {
            if (this.isPlaying) {
                setTimeout(() => {
                    this.scheduleNextPlayRound();
                }, 300 / this.speedMultiplier);
            }
        });
    }

    animateStep(targetRoundIndex, onComplete = null) {
        const nextRoundData = this.simulationRounds[targetRoundIndex];
        const duration = this.baseRoundDuration / this.speedMultiplier;
        const startTime = performance.now();

        const stepAnim = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1.0, elapsed / duration);

            this.renderer.setSimulationState(nextRoundData, progress);

            if (progress < 1.0) {
                this.animationTimer = requestAnimationFrame(stepAnim);
            } else {
                this.goToRound(targetRoundIndex);
                if (onComplete) onComplete();
            }
        };

        this.animationTimer = requestAnimationFrame(stepAnim);
    }

    setupContinuousAnimation() {
        const loop = () => {
            if (!this.isPlaying && this.renderer.activeTransmissions.length === 0) {
                this.renderer.draw();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateStatusBadge(roundData) {
        const totalRounds = this.simulationRounds.length - 1;
        const dot = this.simStatusBadge.querySelector('.status-dot');

        dot.className = 'status-dot';
        if (this.currentRoundIndex === 0) {
            dot.classList.add('ready');
            this.simStatusText.textContent = 'Ready to Route';
        } else if (this.currentRoundIndex < totalRounds) {
            dot.classList.add('running');
            this.simStatusText.textContent = `Routing: Step ${this.currentRoundIndex}`;
        } else {
            dot.classList.add('complete');
            this.simStatusText.textContent = `Completed (${totalRounds} Steps)`;
        }
    }

    updateTimelineUI() {
        if (!this.simulationRounds) return;
        this.timelineEventsList.innerHTML = '';
        this.logCountBadge.textContent = this.currentRoundIndex;

        for (let r = 0; r <= this.currentRoundIndex; r++) {
            const round = this.simulationRounds[r];
            const isCurrent = r === this.currentRoundIndex;

            const card = document.createElement('div');
            card.className = `timeline-round-card ${isCurrent ? 'current-round-highlight' : ''}`;

            const header = document.createElement('div');
            header.className = 'round-card-header';
            header.innerHTML = `
                <span>Step ${round.roundNumber}: ${round.phase}</span>
                <span class="round-card-badge">${round.events.length} event(s)</span>
            `;
            card.appendChild(header);

            const actionList = document.createElement('div');
            actionList.className = 'timeline-action-list';

            round.events.forEach(evt => {
                const item = document.createElement('div');
                item.className = `timeline-action-item action-${evt.type}`;

                let icon = '🧭';
                if (evt.type === 'rreq') icon = '📡';
                else if (evt.type === 'rrep') icon = '📨';
                else if (evt.type === 'data') icon = '🚀';
                else if (evt.type === 'cache') icon = '🎯';
                else if (evt.type === 'duplicate') icon = '⚠️';

                item.innerHTML = `
                    <span class="action-icon">${icon}</span>
                    <span class="action-text">${evt.text}</span>
                `;
                actionList.appendChild(item);
            });

            card.appendChild(actionList);
            this.timelineEventsList.appendChild(card);
        }

        // Automatically scroll log up to top when at round 0 or changes are applied
        if (this.currentRoundIndex === 0) {
            this.scrollLogToTop(false);
        } else {
            const currentCard = this.timelineEventsList.querySelector('.event-round-card.current');
            if (currentCard) {
                currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    updateInspector(nodeId) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return;

        this.inspectorTitle.textContent = `Node ${node.id} Route Cache`;
        this.inspectorSubtitle.textContent = `Inspecting DSR state & cached paths`;

        const roundData = this.simulationRounds[this.currentRoundIndex];
        const nodeData = roundData ? roundData.nodeStates[nodeId] : null;
        const neighbors = this.graph.getNeighbors(nodeId);
        const cacheEntries = nodeData ? nodeData.cache : [];

        let roleBadge = 'Intermediate Node';
        if (node.id === this.sourceSelect.value) roleBadge = 'Source Node';
        else if (node.id === this.destSelect.value) roleBadge = 'Destination Node';

        // Detect live action matching the canvas animation in the current round
        let roundActionText = '💤 Idle: No active transmissions for this node in this round';
        let statusBadgeClass = 'val';

        if (roundData && roundData.transmissions) {
            const outTransmissions = roundData.transmissions.filter(t => t.from === nodeId);
            const inTransmissions = roundData.transmissions.filter(t => t.to === nodeId);

            if (outTransmissions.length > 0) {
                const tx = outTransmissions[0];
                const targets = outTransmissions.map(t => t.to);
                if (tx.type === 'RREQ') {
                    roundActionText = `📤 Transmitting RREQ: Broadcasting discovery packet to [${targets.join(', ')}] across links`;
                } else if (tx.type === 'RREP') {
                    roundActionText = `📨 Unicasting RREP: Returning route reply towards [${targets.join(', ')}]`;
                } else {
                    roundActionText = `🚀 Forwarding DATA: Strict source-routed delivery to [${targets.join(', ')}]`;
                }
                statusBadgeClass = 'val highlight-purple';
            } else if (inTransmissions.length > 0) {
                const tx = inTransmissions[0];
                const senders = inTransmissions.map(t => t.from);
                if (node.id === this.destSelect.value) {
                    roundActionText = `🎯 Destination: Received ${tx.type || 'packet'} from Node ${senders.join(', ')}`;
                    statusBadgeClass = 'val highlight-emerald';
                } else if (node.id === this.sourceSelect.value && tx.type === 'RREP') {
                    roundActionText = `✅ Source Received RREP: Route discovered and cached from ${senders.join(', ')}`;
                    statusBadgeClass = 'val highlight-emerald';
                } else {
                    roundActionText = `📥 Receiving ${tx.type || 'packet'}: Inbound from [${senders.join(', ')}]`;
                    statusBadgeClass = 'val highlight-purple';
                }
            }
        }

        let statusText = nodeData ? nodeData.state.toUpperCase() : 'IDLE';

        this.inspectorBody.className = 'inspector-body';
        this.inspectorBody.innerHTML = `
            <div class="inspector-card">
                <h4>Live Animation Action (Round ${this.currentRoundIndex})</h4>
                <div class="key-value-list">
                    <div class="key-value-row">
                        <span class="key">Current Action</span>
                        <span class="${statusBadgeClass}">${roundActionText}</span>
                    </div>
                    <div class="key-value-row">
                        <span class="key">Protocol State</span>
                        <span class="val">${statusText}</span>
                    </div>
                    <div class="key-value-row">
                        <span class="key">Protocol Role</span>
                        <span class="val">${roleBadge}</span>
                    </div>
                    <div class="key-value-row">
                        <span class="key">1-Hop Neighbors</span>
                        <span class="val">[${neighbors.join(', ')}]</span>
                    </div>
                    <div class="key-value-row">
                        <span class="key">Seen RREQs</span>
                        <span class="val">${nodeData ? nodeData.seenRREQs.length : 0}</span>
                    </div>
                </div>
            </div>

            <div class="inspector-card">
                <h4>Route Cache Table (${cacheEntries.length})</h4>
                ${cacheEntries.length > 0 ? `
                    <table class="cache-table">
                        <thead>
                            <tr>
                                <th>Target</th>
                                <th>Full Path</th>
                                <th>Hops</th>
                                <th>Learned Via</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cacheEntries.map(c => `
                                <tr>
                                    <td><strong>${c.dest}</strong></td>
                                    <td><span class="code-ref">${c.path.join('→')}</span></td>
                                    <td>${c.hops}</td>
                                    <td><span style="font-size:10px; color:#c084fc;">${c.learnedVia}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `<p class="text-muted" style="font-size:11.5px; padding:4px 0;">Route cache is currently empty for this node.</p>`}
            </div>
        `;

        // Automatically scroll inspection log up when node details or round changes
        this.scrollLogToTop(true);
    }

    updateMetricsUI(stats) {
        if (!stats) return;

        this.metricRreq.textContent = stats.rreqCount;
        this.metricRrep.textContent = stats.rrepCount;
        this.metricDataHops.textContent = stats.dataHops;
        this.metricTotalMsgs.textContent = stats.totalMsgs;
        this.metricDeliveryStatus.textContent = stats.deliveryStatus;

        if (stats.routePath) {
            this.metricRouteStatus.textContent = 'Found';
            this.metricRoutePath.textContent = stats.routePath;
            this.metricSourceRouteBox.innerHTML = `
                <div class="path-chip">
                    <span>Source Route: ${stats.routePath}</span>
                    <span class="path-hops">${stats.activeRouteNodes.length - 1} hops</span>
                </div>
            `;
        } else {
            this.metricRouteStatus.textContent = 'Discovering';
            this.metricRoutePath.textContent = 'Searching...';
            this.metricSourceRouteBox.innerHTML = `<p class="text-muted">No route discovered yet.</p>`;
        }
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new DSRSimulationController();
});
