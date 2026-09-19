/**
 * Flooding Protocol Interactive Visualizer
 * Core Simulation Engine, Graph Engine, Canvas Renderer, and Step Controller.
 */

// ============================================================================
// 1. Network Graph Model & Topology Generators
// ============================================================================

class NetworkGraph {
    constructor() {
        this.nodes = new Map(); // id -> { id, label, x, y, radius }
        this.edges = [];        // [{ id, u, v }]
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
        // Check if edge already exists in either direction
        const exists = this.edges.some(e => 
            (e.u === u && e.v === v) || (e.u === v && e.v === u)
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

    // Topologies
    static createMesh(width, height) {
        const g = new NetworkGraph();
        const cx = width / 2;
        const cy = height / 2;
        const rx = Math.min(width * 0.38, 320);
        const ry = Math.min(height * 0.38, 220);

        // 8 nodes layout: Ring with cross-links
        const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const total = nodeIds.length;

        nodeIds.forEach((id, i) => {
            const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * rx;
            const y = cy + Math.sin(angle) * ry;
            g.addNode(id, x, y);
        });

        // Ring outer links
        for (let i = 0; i < total; i++) {
            g.addEdge(nodeIds[i], nodeIds[(i + 1) % total]);
        }

        // Cross links creating rich alternate paths
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

        // Root
        g.addNode('A', cx, topY);

        // Level 1
        g.addNode('B', cx - width * 0.25, midY);
        g.addNode('C', cx + width * 0.25, midY);
        g.addEdge('A', 'B');
        g.addEdge('A', 'C');

        // Level 2
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

        // Grid-like adhoc cluster
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
// 2. Flooding Protocol Simulation Engine
// ============================================================================

class FloodingEngine {
    /**
     * Precomputes all discrete rounds for the flooding process.
     * Generates snapshots with complete state for immediate bidirectional scrubbing.
     */
    static runSimulation(graph, sourceId, destId, initialTTL = 5, duplicateSuppression = true, broadcastMode = 'all') {
        const rounds = [];
        const packetSeq = 1;
        const packetId = `P${packetSeq}`;

        // Initialize state mapping
        const nodeIds = Array.from(graph.nodes.keys());
        const initialNodeStates = {};
        for (const id of nodeIds) {
            initialNodeStates[id] = {
                id,
                state: id === sourceId ? 'source' : (id === destId ? 'dest' : 'idle'),
                cache: [], // list of seen packets: { packetId, from, ttl, round }
                droppedDuplicates: 0,
                droppedTTL: 0,
                deliveredCount: 0,
                forwardedCount: 0
            };
        }

        // Track stats
        const stats = {
            sent: 0,
            delivered: 0,
            duplicates: 0,
            ttlExpired: 0,
            minHops: null,
            overheadRatio: 0,
            deliveryPaths: []
        };

        // Round 0: Initial state before any packet transmission
        rounds.push({
            roundNumber: 0,
            summary: `Initial State: Source Node [${sourceId}] prepared with TTL = ${initialTTL}`,
            nodeStates: JSON.parse(JSON.stringify(initialNodeStates)),
            transmissions: [],
            events: [{
                type: 'ready',
                nodeId: sourceId,
                text: `Source node <strong>${sourceId}</strong> initialized. Destination target is <strong>${destId}</strong> with initial TTL = ${initialTTL}.`
            }],
            stats: { ...stats }
        });

        // Prepare queue for BFS flooding
        // Each item in queue: { from, to, ttl, path, packetId }
        let currentQueue = [];

        // Round 1: Source broadcasts to all its 1-hop neighbors
        const sourceNeighbors = graph.getNeighbors(sourceId);
        if (sourceNeighbors.length === 0) {
            // Isolated source
            rounds[0].events.push({
                type: 'ttl',
                nodeId: sourceId,
                text: `Source node <strong>${sourceId}</strong> has no connected neighbors. Flooding cannot proceed.`
            });
            return rounds;
        }

        // Source caches its own packet
        initialNodeStates[sourceId].cache.push({ packetId, from: 'SELF', ttl: initialTTL, round: 0 });

        for (const neighbor of sourceNeighbors) {
            currentQueue.push({
                from: sourceId,
                to: neighbor,
                ttl: initialTTL,
                path: [sourceId, neighbor],
                packetId
            });
            stats.sent++;
            initialNodeStates[sourceId].forwardedCount++;
        }

        let roundNum = 1;
        let currentNodeStates = JSON.parse(JSON.stringify(initialNodeStates));

        while (currentQueue.length > 0 && roundNum <= 20) {
            const roundTransmissions = [...currentQueue];
            const nextQueue = [];
            const roundEvents = [];

            // Node states for this round
            const nextNodeStates = JSON.parse(JSON.stringify(currentNodeStates));

            // Set transmitting nodes
            roundTransmissions.forEach(t => {
                if (nextNodeStates[t.from].state === 'idle') {
                    nextNodeStates[t.from].state = 'forwarding';
                }
            });

            // 1. Group active transmissions by sender (matches in-flight animation on canvas)
            const senderMap = new Map();
            roundTransmissions.forEach(t => {
                if (!senderMap.has(t.from)) senderMap.set(t.from, []);
                senderMap.get(t.from).push(t.to);
            });

            senderMap.forEach((targets, sender) => {
                const isSource = (sender === sourceId);
                roundEvents.push({
                    type: 'transmit',
                    nodeId: sender,
                    text: isSource
                        ? `📤 <strong>Source Broadcast:</strong> Node <strong>${sender}</strong> transmits packet <span class="code-ref">${packetId}</span> across links to neighbors [${targets.join(', ')}].`
                        : `📤 <strong>Flooding in Flight:</strong> Node <strong>${sender}</strong> transmits packet <span class="code-ref">${packetId}</span> across links to [${targets.join(', ')}].`
                });
            });

            // 2. Process packet arrivals at receivers in this round
            for (const pkt of roundTransmissions) {
                const receiverId = pkt.to;
                const receiver = nextNodeStates[receiverId];
                const arrivedTtl = pkt.ttl;
                const pathStr = pkt.path.join(' → ');

                // A. Check if packet arrived at destination
                if (receiverId === destId) {
                    receiver.state = 'delivered';
                    receiver.deliveredCount++;
                    stats.delivered++;
                    const hops = pkt.path.length - 1;
                    if (stats.minHops === null || hops < stats.minHops) {
                        stats.minHops = hops;
                    }
                    stats.deliveryPaths.push({ path: pkt.path, hops, round: roundNum });

                    roundEvents.push({
                        type: 'delivered',
                        nodeId: receiverId,
                        text: `🎯 <strong>Destination Reached:</strong> Destination Node <strong>${receiverId}</strong> received packet from <strong>${pkt.from}</strong> via path <span class="code-ref">[${pathStr}]</span> (${hops} hops). Delivered!`
                    });
                    continue;
                }

                // B. Check for Duplicate Packet if Duplicate Suppression is active
                const alreadySeen = receiver.cache.some(c => c.packetId === pkt.packetId);
                if (alreadySeen) {
                    if (duplicateSuppression) {
                        receiver.droppedDuplicates++;
                        stats.duplicates++;
                        if (receiver.state !== 'source' && receiver.state !== 'dest') {
                            receiver.state = 'dropped';
                        }

                        roundEvents.push({
                            type: 'duplicate',
                            nodeId: receiverId,
                            text: `⚠️ <strong>Duplicate Dropped:</strong> Node <strong>${receiverId}</strong> received redundant packet from <strong>${pkt.from}</strong>. Already seen in cache → Suppressed.`
                        });
                        continue;
                    } else {
                        roundEvents.push({
                            type: 'duplicate',
                            nodeId: receiverId,
                            text: `⚠️ <strong>Duplicate Arrived:</strong> Node <strong>${receiverId}</strong> received duplicate from <strong>${pkt.from}</strong>. Duplicate suppression is OFF → Rebroadcasting (Storm)!`
                        });
                    }
                }

                // C. Check TTL expiration
                if (arrivedTtl <= 1) {
                    receiver.droppedTTL++;
                    stats.ttlExpired++;
                    if (receiver.state !== 'source' && receiver.state !== 'dest') {
                        receiver.state = 'dropped';
                    }

                    roundEvents.push({
                        type: 'ttl',
                        nodeId: receiverId,
                        text: `🛑 <strong>TTL Expired:</strong> Packet from <strong>${pkt.from}</strong> arrived at Node <strong>${receiverId}</strong> with TTL = 1 → Decremented to 0, discarded.`
                    });
                    continue;
                }

                // D. Valid packet to forward: cache and prepare forwarding for next round
                receiver.cache.push({
                    packetId: pkt.packetId,
                    from: pkt.from,
                    ttl: arrivedTtl,
                    round: roundNum
                });

                if (receiver.state !== 'source' && receiver.state !== 'dest') {
                    receiver.state = 'forwarding';
                }

                const neighbors = graph.getNeighbors(receiverId);
                const forwardTargets = (broadcastMode === 'all')
                    ? neighbors
                    : neighbors.filter(n => n !== pkt.from);

                if (forwardTargets.length > 0) {
                    const newTtl = arrivedTtl - 1;
                    forwardTargets.forEach(target => {
                        nextQueue.push({
                            from: receiverId,
                            to: target,
                            ttl: newTtl,
                            path: [...pkt.path, target],
                            packetId: pkt.packetId
                        });
                        stats.sent++;
                        receiver.forwardedCount++;
                    });

                    const modeNotice = (broadcastMode === 'all') ? ' across all directions' : '';
                    roundEvents.push({
                        type: 'ready',
                        nodeId: receiverId,
                        text: `📥 <strong>Packet Accepted:</strong> Node <strong>${receiverId}</strong> cached packet from <strong>${pkt.from}</strong> (remaining TTL: ${arrivedTtl}). Queued to flood${modeNotice} to [${forwardTargets.join(', ')}] in Round ${roundNum + 1}.`
                    });
                } else {
                    roundEvents.push({
                        type: 'ready',
                        nodeId: receiverId,
                        text: `📥 <strong>Accepted (Dead End):</strong> Node <strong>${receiverId}</strong> cached packet from <strong>${pkt.from}</strong>, but has no other neighbors to forward to.`
                    });
                }
            }

            // Calculate overhead ratio
            stats.overheadRatio = stats.delivered > 0 
                ? (stats.sent / stats.delivered).toFixed(2) 
                : stats.sent;

            const sendersList = Array.from(senderMap.keys()).join(', ');
            const receiversList = Array.from(new Set(roundTransmissions.map(t => t.to))).join(', ');

            rounds.push({
                roundNumber: roundNum,
                summary: `Round ${roundNum}: ${roundTransmissions.length} packet(s) in flight (${sendersList} → ${receiversList})`,
                nodeStates: JSON.parse(JSON.stringify(nextNodeStates)),
                transmissions: roundTransmissions,
                events: roundEvents,
                stats: { ...stats }
            });

            currentNodeStates = nextNodeStates;
            currentQueue = nextQueue;
            roundNum++;
        }

        // Final completion round indicator
        const finalRound = rounds[rounds.length - 1];
        if (stats.delivered > 0) {
            finalRound.events.push({
                type: 'delivered',
                nodeId: destId,
                text: `✅ Flooding completed. Destination <strong>${destId}</strong> received packet successfully.`
            });
        } else {
            finalRound.events.push({
                type: 'ttl',
                nodeId: destId,
                text: `❌ Simulation ended without reaching destination. Consider increasing TTL or checking network connectivity.`
            });
        }

        return rounds;
    }
}

// ============================================================================
// 3. Canvas Renderer & Visual Effects
// ============================================================================

class NetworkRenderer {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;

        // Interaction state
        this.draggedNode = null;
        this.hoveredNode = null;
        this.selectedNodeId = null;
        this.connectSourceNode = null;
        this.isConnectMode = false;
        this.isEditMode = false;

        // Animation interpolation state
        this.activeTransmissions = [];
        this.packetProgress = 1.0; // 0.0 to 1.0
        this.pulseTime = 0;
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

        // Mouse Down
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
                // Click on blank canvas in edit mode creates a node
                const nextLetter = this.getNextNodeId();
                if (nextLetter) {
                    this.graph.addNode(nextLetter, pos.x, pos.y);
                    if (window.app) window.app.onGraphStructureChanged();
                    this.draw();
                }
            }
        });

        // Mouse Move
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

        // Mouse Up
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
            if (Math.hypot(dx, dy) <= node.radius + 6) {
                return node;
            }
        }
        return null;
    }

    setSimulationState(roundData, packetProgress = 1.0) {
        this.currentRound = roundData;
        this.packetProgress = packetProgress;
        this.activeTransmissions = roundData ? roundData.transmissions : [];
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
            // Ease-out cubic: 1 - (1 - t)^3
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

        // 1. Draw subtle background dot matrix
        this.drawGrid();

        // 2. Draw Graph Edges
        this.drawEdges();

        // 3. Draw In-transit Animated Packets & Broadcast Wavefronts
        if (this.activeTransmissions.length > 0 && this.packetProgress < 1.0) {
            this.drawBroadcastWaves();
            this.drawPackets();
        }

        // 4. Draw Nodes
        this.drawNodes();
    }

    drawBroadcastWaves() {
        const ctx = this.ctx;
        const p = Math.min(1.0, Math.max(0.0, this.packetProgress));
        if (p <= 0 || p >= 1.0) return;

        // Radiating 360-degree broadcast waves for active sender nodes
        const senders = new Set(this.activeTransmissions.map(t => t.from));
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

            // Check if this edge is active in current round transmissions
            const isActive = this.activeTransmissions.some(t => 
                (t.from === u.id && t.to === v.id) || (t.from === v.id && t.to === u.id)
            );

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(u.x, u.y);
            ctx.lineTo(v.x, v.y);

            if (isActive) {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 3;
                ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
                ctx.shadowBlur = 10;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.lineWidth = 2;
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    drawPackets() {
        const ctx = this.ctx;
        const p = Math.min(1.0, Math.max(0.0, this.packetProgress));

        for (const tx of this.activeTransmissions) {
            const from = this.graph.nodes.get(tx.from);
            const to = this.graph.nodes.get(tx.to);
            if (!from || !to) continue;

            // Interpolate position along edge
            const curX = from.x + (to.x - from.x) * p;
            const curY = from.y + (to.y - from.y) * p;

            ctx.save();

            // Packet Outer Glow
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 14;

            // Packet Body
            ctx.beginPath();
            ctx.arc(curX, curY, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Packet TTL pill
            ctx.shadowBlur = 0;
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tx.ttl, curX, curY);

            // Small direction chevron or trail
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const trailX = curX - Math.cos(angle) * 14;
            const trailY = curY - Math.sin(angle) * 14;

            ctx.beginPath();
            ctx.arc(trailX, trailY, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.fill();

            ctx.restore();
        }
    }

    drawNodes() {
        const ctx = this.ctx;
        const nodeStates = this.currentRound ? this.currentRound.nodeStates : null;

        for (const node of this.graph.nodes.values()) {
            const nodeStateData = nodeStates ? nodeStates[node.id] : null;
            const state = nodeStateData ? nodeStateData.state : 'idle';
            const isHovered = this.hoveredNode === node;
            const isSelected = this.selectedNodeId === node.id;
            const isConnectSource = this.connectSourceNode === node;

            ctx.save();

            // Determine theme color
            let fillColor = '#1e293b';
            let strokeColor = '#475569';
            let glowColor = 'transparent';
            let glowBlur = 0;

            if (state === 'source') {
                fillColor = '#0c4a6e';
                strokeColor = '#00f2fe';
                glowColor = 'rgba(0, 242, 254, 0.7)';
                glowBlur = 20;
            } else if (state === 'dest') {
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                glowColor = 'rgba(16, 185, 129, 0.7)';
                glowBlur = 20;
            } else if (state === 'forwarding') {
                fillColor = '#312e81';
                strokeColor = '#818cf8';
                glowColor = 'rgba(129, 140, 248, 0.6)';
                glowBlur = 16;
            } else if (state === 'delivered') {
                fillColor = '#064e3b';
                strokeColor = '#10b981';
                glowColor = 'rgba(16, 185, 129, 0.8)';
                glowBlur = 24;
            } else if (state === 'dropped') {
                fillColor = '#4c0519';
                strokeColor = '#f43f5e';
                glowColor = 'rgba(244, 63, 94, 0.5)';
                glowBlur = 14;
            }

            if (isSelected) {
                strokeColor = '#ffffff';
            }

            // Pulse wave ring for source / forwarding nodes
            if (state === 'source' || state === 'forwarding' || state === 'delivered') {
                const pulseRadius = node.radius + 6 + (Math.sin(this.pulseTime) + 1) * 4;
                ctx.beginPath();
                ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // Node Circle
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = glowBlur;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();

            // Node Border
            ctx.lineWidth = isSelected ? 3.5 : (isHovered ? 2.8 : 2);
            ctx.strokeStyle = isConnectSource ? '#f59e0b' : strokeColor;
            ctx.stroke();

            // Node Label
            ctx.shadowBlur = 0;
            ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y);

            // Small badge for node role / cache count
            if (nodeStateData && nodeStateData.cache.length > 0) {
                ctx.beginPath();
                ctx.arc(node.x + node.radius * 0.7, node.y - node.radius * 0.7, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#0ea5e9';
                ctx.fill();
                ctx.font = '700 8.5px "JetBrains Mono", monospace';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(nodeStateData.cache.length, node.x + node.radius * 0.7, node.y - node.radius * 0.7);
            }

            ctx.restore();
        }
    }
}

// ============================================================================
// 4. Playback Controller & UI Integration
// ============================================================================

class SimulationController {
    constructor() {
        this.graph = null;
        this.renderer = null;
        this.simulationRounds = [];
        this.currentRoundIndex = 0;

        // Playback state
        this.isPlaying = false;
        this.speedMultiplier = 1.0;
        this.baseRoundDuration = 1200; // ms per round
        this.animationTimer = null;
        this.animStartTime = null;

        // Controls
        this.sourceSelect = document.getElementById('source-select');
        this.destSelect = document.getElementById('dest-select');
        this.ttlSlider = document.getElementById('ttl-slider');
        this.ttlValueChip = document.getElementById('ttl-value');
        this.duplicateToggle = document.getElementById('duplicate-toggle');
        this.broadcastModeSelect = document.getElementById('broadcast-mode-select');
        this.topologySelect = document.getElementById('topology-select');
        this.btnStart = document.getElementById('btn-start-simulation');
        this.btnEditMode = document.getElementById('btn-edit-mode');

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

        // Sidebar Tabs
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');
        this.timelineEventsList = document.getElementById('timeline-events-list');
        this.logCountBadge = document.getElementById('log-count-badge');
        this.inspectorBody = document.getElementById('inspector-body');
        this.inspectorTitle = document.getElementById('inspector-node-title');
        this.inspectorSubtitle = document.getElementById('inspector-node-subtitle');
        this.sidebarContent = document.querySelector('.sidebar-content');

        // Metrics elements
        this.metricSent = document.getElementById('metric-sent');
        this.metricDelivered = document.getElementById('metric-delivered');
        this.metricDuplicates = document.getElementById('metric-duplicates');
        this.metricTtlExpired = document.getElementById('metric-ttl-expired');
        this.metricMinHops = document.getElementById('metric-min-hops');
        this.metricOverhead = document.getElementById('metric-overhead');
        this.metricPathsList = document.getElementById('metric-paths-list');

        // Status Badge
        this.simStatusText = document.getElementById('sim-status-text');
        this.simStatusBadge = document.getElementById('sim-status-badge');
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

        // Initialize default mesh
        this.graph = NetworkGraph.createMesh(width, height);
        this.renderer = new NetworkRenderer(canvas, this.graph);

        this.populateNodeSelects('A', 'G');
        this.bindEvents();
        this.setupContinuousAnimation();
        this.runSimulation(); // pre-calculate initial simulation
    }

    bindEvents() {
        // TTL Slider
        this.ttlSlider.addEventListener('input', (e) => {
            this.ttlValueChip.textContent = e.target.value;
            this.runSimulation();
        });

        // Duplicate Toggle
        this.duplicateToggle.addEventListener('change', () => {
            this.runSimulation();
        });

        // Broadcast Mode Selector
        if (this.broadcastModeSelect) {
            this.broadcastModeSelect.addEventListener('change', () => {
                this.runSimulation();
            });
        }

        // Source / Dest Select
        this.sourceSelect.addEventListener('change', () => this.runSimulation());
        this.destSelect.addEventListener('change', () => this.runSimulation());

        // Topology selector
        this.topologySelect.addEventListener('change', (e) => {
            this.loadTopology(e.target.value);
        });

        // Run Simulation Button
        this.btnStart.addEventListener('click', () => {
            this.runSimulation();
            this.play();
        });

        // Playback Controller Buttons
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

        // Speed Pills
        this.speedBtnGroup.addEventListener('click', (e) => {
            const pill = e.target.closest('.speed-pill');
            if (!pill) return;
            this.speedBtnGroup.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            this.speedMultiplier = parseFloat(pill.dataset.speed);
        });

        // Sidebar Tabs
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.tabButtons.forEach(b => b.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(targetTab);
                if (pane) pane.classList.add('active');
                this.scrollLogToTop(false);
            });
        });

        // Edit Mode Toggle
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

        // Ensure source !== dest if possible
        if (this.sourceSelect.value === this.destSelect.value && nodeIds.length > 1) {
            this.destSelect.selectedIndex = (this.sourceSelect.selectedIndex + 1) % nodeIds.length;
        }
    }

    onGraphStructureChanged() {
        this.populateNodeSelects();
        this.runSimulation();
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

    onNodeSelected(nodeId) {
        this.updateInspector(nodeId);
        // Switch to inspector tab
        const inspectorTabBtn = document.querySelector('[data-tab="tab-inspector"]');
        if (inspectorTabBtn) inspectorTabBtn.click();
        this.scrollLogToTop(true);
    }

    runSimulation() {
        const src = this.sourceSelect.value;
        const dest = this.destSelect.value;
        const ttl = parseInt(this.ttlSlider.value, 10);
        const dupSuppression = this.duplicateToggle.checked;
        const broadcastMode = this.broadcastModeSelect ? this.broadcastModeSelect.value : 'all';

        if (!src || !dest) return;

        this.simulationRounds = FloodingEngine.runSimulation(
            this.graph,
            src,
            dest,
            ttl,
            dupSuppression,
            broadcastMode
        );

        this.timelineSlider.max = Math.max(0, this.simulationRounds.length - 1);
        this.timelineSlider.disabled = this.simulationRounds.length <= 1;

        // Reset to round 0 and scroll inspection log up to top
        this.goToRound(0);
        this.scrollLogToTop(true);
    }

    goToRound(index) {
        if (!this.simulationRounds || this.simulationRounds.length === 0) return;
        this.currentRoundIndex = Math.max(0, Math.min(index, this.simulationRounds.length - 1));
        const roundData = this.simulationRounds[this.currentRoundIndex];

        this.timelineSlider.value = this.currentRoundIndex;
        this.currentRoundText.textContent = `Round ${this.currentRoundIndex} / ${this.simulationRounds.length - 1}`;

        // Update renderer
        this.renderer.setSimulationState(roundData, 1.0);

        // Update UI panels
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

        // If at end, loop back to start
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
                // Pause slightly before next round
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
        // Continuous ambient animation loop (node pulse rings, glow)
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
            this.simStatusText.textContent = 'Ready to Simulate';
        } else if (this.currentRoundIndex < totalRounds) {
            dot.classList.add('running');
            this.simStatusText.textContent = `Running: Round ${this.currentRoundIndex}`;
        } else {
            dot.classList.add('complete');
            this.simStatusText.textContent = `Simulation Complete (${totalRounds} Rounds)`;
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
                <span>Round ${round.roundNumber}</span>
                <span class="round-card-badge">${round.events.length} event(s)</span>
            `;
            card.appendChild(header);

            const actionList = document.createElement('div');
            actionList.className = 'timeline-action-list';

            round.events.forEach(evt => {
                const item = document.createElement('div');
                item.className = `timeline-action-item action-${evt.type}`;

                let icon = 'ℹ️';
                if (evt.type === 'transmit') icon = '📤';
                else if (evt.type === 'delivered') icon = '🎉';
                else if (evt.type === 'duplicate') icon = '⚠️';
                else if (evt.type === 'ttl') icon = '🛑';

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
            // Keep active round card visible in view smoothly
            const currentCard = this.timelineEventsList.querySelector('.current-round-highlight');
            if (currentCard) {
                currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    updateInspector(nodeId) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return;

        this.inspectorTitle.textContent = `Node ${node.id} Details`;
        this.inspectorSubtitle.textContent = `Live protocol & animation inspection`;

        const roundData = this.simulationRounds ? this.simulationRounds[this.currentRoundIndex] : null;
        const nodeState = roundData && roundData.nodeStates ? roundData.nodeStates[nodeId] : null;
        const neighbors = this.graph.getNeighbors(nodeId);

        let roleBadge = 'Intermediate Node';
        if (node.id === this.sourceSelect.value) roleBadge = 'Source (Originator)';
        else if (node.id === this.destSelect.value) roleBadge = 'Destination (Target)';

        // Detect live action matching the canvas animation in the current round
        let roundActionText = '💤 Idle: No active packets for this node in this round';
        let statusBadgeClass = 'val';

        if (roundData && roundData.transmissions) {
            const outTransmissions = roundData.transmissions.filter(t => t.from === nodeId);
            const inTransmissions = roundData.transmissions.filter(t => t.to === nodeId);

            if (outTransmissions.length > 0) {
                const targets = outTransmissions.map(t => t.to);
                roundActionText = `📤 Transmitting: Broadcasting packet to [${targets.join(', ')}] across links`;
                statusBadgeClass = 'val highlight-cyan';
            } else if (inTransmissions.length > 0) {
                const senders = inTransmissions.map(t => t.from);
                if (node.id === this.destSelect.value) {
                    roundActionText = `🎯 Delivered: Received payload from Node ${senders.join(', ')}`;
                    statusBadgeClass = 'val highlight-emerald';
                } else if (nodeState && nodeState.state === 'dropped') {
                    roundActionText = `⚠️ Dropped: Inbound packet from ${senders.join(', ')} suppressed/expired`;
                    statusBadgeClass = 'val highlight-rose';
                } else {
                    roundActionText = `📥 Receiving: Inbound packet arriving from [${senders.join(', ')}]`;
                    statusBadgeClass = 'val highlight-cyan';
                }
            }
        }

        let statusText = nodeState ? nodeState.state.toUpperCase() : 'IDLE';

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
                        <span class="key">Forwarded Packets</span>
                        <span class="val">${nodeState ? nodeState.forwardedCount : 0}</span>
                    </div>
                    <div class="key-value-row">
                        <span class="key">Duplicate Drops</span>
                        <span class="val">${nodeState ? nodeState.droppedDuplicates : 0}</span>
                    </div>
                </div>
            </div>

            <div class="inspector-card">
                <h4>Duplicate Detection Cache (${nodeState ? nodeState.cache.length : 0})</h4>
                ${nodeState && nodeState.cache.length > 0 ? `
                    <table class="cache-table">
                        <thead>
                            <tr>
                                <th>Packet ID</th>
                                <th>Arrived Via</th>
                                <th>TTL</th>
                                <th>Round</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${nodeState.cache.map(c => `
                                <tr>
                                    <td><span class="code-ref">${c.packetId}</span></td>
                                    <td>${c.from}</td>
                                    <td>${c.ttl}</td>
                                    <td>R${c.round}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `<p class="text-muted" style="font-size:11.5px; padding:4px 0;">No packets recorded in cache yet.</p>`}
            </div>
        `;

        // Automatically scroll inspection log up when node details or round changes
        this.scrollLogToTop(true);
    }

    updateMetricsUI(stats) {
        if (!stats) return;

        this.metricSent.textContent = stats.sent;
        this.metricDelivered.textContent = stats.delivered;
        this.metricDuplicates.textContent = stats.duplicates;
        this.metricTtlExpired.textContent = stats.ttlExpired;
        this.metricMinHops.textContent = stats.minHops !== null ? stats.minHops : '-';
        this.metricOverhead.textContent = stats.overheadRatio ? `${stats.overheadRatio}x` : '-';

        // Paths List
        if (stats.deliveryPaths && stats.deliveryPaths.length > 0) {
            this.metricPathsList.innerHTML = stats.deliveryPaths.map((p, i) => `
                <div class="path-chip">
                    <span>#${i + 1}: ${p.path.join(' → ')}</span>
                    <span class="path-hops">${p.hops} hops (R${p.round})</span>
                </div>
            `).join('');
        } else {
            this.metricPathsList.innerHTML = `<p class="text-muted">No packets reached destination yet.</p>`;
        }
    }
}

// ============================================================================
// 5. App Bootstrap
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    window.app = new SimulationController();
});
