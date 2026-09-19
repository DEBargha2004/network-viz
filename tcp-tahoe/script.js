/**
 * TCP Tahoe Protocol Interactive Visualizer
 * Fully Aligned with Textbook Figure 24.11 (Jacobson 1988) & Cumulative ACK Miss Tracking:
 * - Slow Start (SS, Exponential 2x)
 * - Additive Increase (AI / Congestion Avoidance CA, +1 MSS per RTT)
 * - Multiplicative Decrease (MD) on Time-out (reset to 1) and 3 Duplicate ACKs (Fast Retransmit)
 * - Detailed Packet & ACK Miss Timeline (Packets 1-7, Missing Packet 4, Duplicate ACKs 3, 3, 3)
 */

// ============================================================================
// 1. TCP Tahoe Engine (Figure 24.11 & Scenarios)
// ============================================================================

class TahoeEngine {
    static generateSimulation(initialSsthresh = 16, bufferCapacity = 24, scenario = 'textbook_24_11', forceLossAtRtt = null) {
        const snapshots = [];

        // Dispatch to dedicated scenario generators
        if (scenario === 'textbook_24_11') {
            return this.generateFigure2411();
        }
        if (scenario === 'slow_start_exponential') {
            return this.generateSlowStartExponential();
        }
        if (scenario === 'congestion_avoidance_linear') {
            return this.generateCongestionAvoidanceLinear();
        }
        if (scenario === 'fast_retransmit_3ack' || scenario === 'ack_miss_demo') {
            return this.generateFastRetransmit3Ack();
        }
        if (scenario === 'severe_timeout_rto' || scenario === 'timeout') {
            return this.generateSevereTimeoutRto();
        }
        if (scenario === 'buffer_overflow_taildrop' || scenario === 'buffer_overflow' || scenario === 'sawtooth') {
            return this.generateBufferOverflowTailDrop();
        }
        if (scenario === 'tahoe_vs_reno') {
            return this.generateTahoeVsReno();
        }
        if (scenario === 'random_wireless_loss') {
            return this.generateRandomWirelessLoss();
        }
        if (scenario === 'high_bdp_pipe') {
            return this.generateHighBdpPipe();
        }

        // Generic simulation with customizable ssthresh and buffer capacity
        const maxRtts = 24;
        let cwnd = 1;
        let ssthresh = initialSsthresh;
        let phase = 'SLOW START';
        let totalDelivered = 0;
        let lossCount = 0;
        let peakCwnd = 1;
        let cumulativeSeq = 0;
        const lossHistory = [];

        let renoCwnd = 1;
        let renoSsthresh = initialSsthresh;
        let renoPhase = 'SLOW START';
        const renoHistory = [{ rtt: 0, cwnd: 1, ssthresh: renoSsthresh, phase: 'SLOW START' }];

        snapshots.push({
            rtt: 0,
            cwnd: 1,
            nextCwnd: 1,
            ssthresh: ssthresh,
            phase: 'SLOW START',
            packetsSent: 0,
            packetsDelivered: 0,
            routerQueue: 0,
            bufferCapacity: bufferCapacity,
            isLoss: false,
            lossType: null,
            lossReason: null,
            renoCwnd: 1,
            startSeq: 1,
            endSeq: 1,
            packetsTrack: [],
            acksTrack: [],
            events: [{
                type: 'slowstart',
                text: `Connection initialized. <strong>TCP Tahoe</strong> starting at <code>cwnd = 1 MSS</code>, <code>ssthresh = ${ssthresh} MSS</code>.`
            }],
            stats: {
                peakCwnd: 1,
                delivered: 0,
                losses: 0,
                curSsthresh: ssthresh,
                avgThroughput: 0,
                goodput: 100,
                lossHistory: []
            }
        });

        for (let r = 1; r <= maxRtts; r++) {
            const startCwnd = cwnd;
            const startSsthresh = ssthresh;
            const startPhase = phase;
            const roundEvents = [];

            const startSeq = cumulativeSeq + 1;
            const endSeq = cumulativeSeq + startCwnd;

            let isLoss = false;
            let lossType = null;
            let lossReason = '';

            if (forceLossAtRtt === r) {
                isLoss = true;
                lossType = 'timeout';
                lossReason = 'User Triggered Time-out (RTO Expired)';
            } else if (scenario === 'buffer_overflow' && cwnd > bufferCapacity) {
                isLoss = true;
                lossType = 'overflow';
                lossReason = `Buffer Overflow: cwnd (${cwnd}) exceeded Router Buffer Capacity (${bufferCapacity})`;
            } else if (scenario === 'timeout' && r === 8) {
                isLoss = true;
                lossType = 'timeout';
                lossReason = 'Time-out: RTO timer expired';
            } else if (scenario === 'sawtooth' && cwnd > bufferCapacity) {
                isLoss = true;
                lossType = 'overflow';
                lossReason = `Router Bottleneck: cwnd (${cwnd}) exceeded Buffer (${bufferCapacity})`;
            }

            let nextCwnd = cwnd;
            let nextSsthresh = ssthresh;
            let nextPhase = phase;
            const routerQueue = Math.min(cwnd, bufferCapacity);

            // Generate detailed packet and ACK track for all packets in the window
            const packetsTrack = [];
            const acksTrack = [];

            if (isLoss) {
                lossCount++;
                nextSsthresh = Math.max(2, Math.floor(cwnd / 2));
                nextCwnd = 1;
                nextPhase = 'SLOW START';

                lossHistory.push({
                    rtt: r,
                    droppedCwnd: cwnd,
                    newSsthresh: nextSsthresh,
                    reason: lossReason
                });

                roundEvents.push({
                    type: 'loss',
                    text: `🚨 <strong>MD (Multiplicative Decrease) at RTT ${r}:</strong> ${lossReason}.<br>Threshold updated: <code>ssthresh = ⌊${cwnd}/2⌋ = ${nextSsthresh} MSS</code>. <strong>cwnd resets to 1 MSS</strong> (Slow Start restarts).`
                });

                const safeCount = Math.min(startCwnd, bufferCapacity);
                for (let i = 0; i < startCwnd; i++) {
                    const seq = startSeq + i;
                    if (i < safeCount) {
                        packetsTrack.push({ seq, status: 'delivered' });
                        acksTrack.push({ ack: `ACK ${seq}`, isDup: false });
                    } else {
                        packetsTrack.push({ seq, status: 'lost' });
                        const lastSafeSeq = safeCount > 0 ? (startSeq + safeCount - 1) : 0;
                        acksTrack.push({ ack: `DUP ACK ${lastSafeSeq}`, isDup: true });
                    }
                }

                renoSsthresh = Math.max(2, Math.floor(renoCwnd / 2));
                renoCwnd = renoSsthresh;
                renoPhase = 'CONGESTION AVOIDANCE';
            } else {
                totalDelivered += cwnd;
                cumulativeSeq += cwnd;
                if (cwnd > peakCwnd) peakCwnd = cwnd;

                for (let i = 0; i < startCwnd; i++) {
                    const seq = startSeq + i;
                    packetsTrack.push({ seq, status: 'delivered' });
                    acksTrack.push({ ack: `ACK ${seq}`, isDup: false });
                }

                if (phase === 'SLOW START') {
                    const oldCwnd = cwnd;
                    nextCwnd = cwnd * 2;

                    roundEvents.push({
                        type: 'slowstart',
                        text: `🚀 <strong>SS (Slow Start, RTT ${r}):</strong> Sent ${oldCwnd} pkts, received ${oldCwnd} ACKs. Exponential 2× increase: <code>cwnd: ${oldCwnd} → ${nextCwnd} MSS</code>.`
                    });

                    if (nextCwnd >= ssthresh) {
                        nextPhase = 'CONGESTION AVOIDANCE';
                        roundEvents.push({
                            type: 'avoidance',
                            text: `⚖️ Threshold reached: <code>cwnd (${nextCwnd}) &ge; ssthresh (${ssthresh})</code>. Entering <strong>AI (Additive Increase / Congestion Avoidance)</strong>: +1 MSS per RTT.`
                        });
                    }
                } else {
                    const oldCwnd = cwnd;
                    nextCwnd = cwnd + 1;

                    roundEvents.push({
                        type: 'avoidance',
                        text: `📈 <strong>AI (Additive Increase, RTT ${r}):</strong> Congestion Avoidance (+1 MSS). <code>cwnd: ${oldCwnd} → ${nextCwnd} MSS</code>.`
                    });
                }

                if (renoPhase === 'SLOW START') {
                    renoCwnd = renoCwnd * 2;
                    if (renoCwnd >= renoSsthresh) renoPhase = 'CONGESTION AVOIDANCE';
                } else {
                    renoCwnd = renoCwnd + 1;
                }
            }

            renoHistory.push({ rtt: r, cwnd: renoCwnd, ssthresh: renoSsthresh });

            const avgThroughput = (totalDelivered / r).toFixed(1);
            const totalSent = totalDelivered + (lossCount * 2);
            const goodput = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100;

            snapshots.push({
                rtt: r,
                cwnd: startCwnd,
                nextCwnd: nextCwnd,
                ssthresh: startSsthresh,
                nextSsthresh: nextSsthresh,
                phase: startPhase,
                nextPhase: nextPhase,
                packetsSent: startCwnd,
                packetsDelivered: isLoss ? 0 : startCwnd,
                routerQueue: routerQueue,
                bufferCapacity: bufferCapacity,
                isLoss: isLoss,
                lossType: lossType,
                lossReason: lossReason,
                renoCwnd: renoHistory[r].cwnd,
                startSeq: startSeq,
                endSeq: endSeq,
                packetsTrack: packetsTrack,
                acksTrack: acksTrack,
                events: roundEvents,
                stats: {
                    peakCwnd: peakCwnd,
                    delivered: totalDelivered,
                    losses: lossCount,
                    curSsthresh: startSsthresh,
                    avgThroughput: avgThroughput,
                    goodput: goodput,
                    lossHistory: [...lossHistory]
                }
            });

            cwnd = nextCwnd;
            ssthresh = nextSsthresh;
            phase = nextPhase;
        }

        return snapshots;
    }

    /**
     * Reusable snapshot builder that converts an explicit trajectory array
     * into a fully animated simulation model with packet/ACK flight tokens.
     */
    static buildSnapshotsFromTrajectory(trajectory, bufferCapacity = 24, peakCwnd = 20) {
        const snapshots = [];
        let totalDelivered = 0;
        let cumulativeSeq = 0;
        const lossHistory = [];

        trajectory.forEach((t, idx) => {
            const isLoss = t.isLoss;
            const startSeq = cumulativeSeq + 1;
            const endSeq = cumulativeSeq + t.cwnd;
            if (!isLoss && t.r > 0) {
                totalDelivered += t.cwnd;
                cumulativeSeq += t.cwnd;
            }

            if (isLoss) {
                lossHistory.push({
                    rtt: t.r,
                    droppedCwnd: t.cwnd,
                    newSsthresh: t.newSsthresh || Math.max(2, Math.floor(t.cwnd / 2)),
                    reason: t.lossReason || t.note
                });
            }

            const packetsTrack = [];
            const acksTrack = [];
            const totalPkts = t.cwnd;

            if (isLoss && t.lossType === '3ack') {
                const lostIndex = t.lostIndex || Math.min(4, Math.max(1, Math.floor(totalPkts / 2)));
                for (let i = 1; i <= totalPkts; i++) {
                    const seq = startSeq + i - 1;
                    if (i === lostIndex) {
                        packetsTrack.push({ seq: seq, status: 'lost' });
                        acksTrack.push({ ack: `MISSING #${seq}`, isDup: false, isMissing: true });
                    } else if (i < lostIndex) {
                        packetsTrack.push({ seq: seq, status: 'delivered' });
                        acksTrack.push({ ack: `ACK ${seq}`, isDup: false });
                    } else {
                        packetsTrack.push({ seq: seq, status: 'delivered' });
                        const ackSeq = startSeq + lostIndex - 2;
                        acksTrack.push({ ack: `DUP ACK ${ackSeq > 0 ? ackSeq : 1}`, isDup: true });
                    }
                }
            } else if (isLoss && t.lossType === 'timeout') {
                const deliveredLimit = t.deliveredCount !== undefined ? t.deliveredCount : Math.min(totalPkts, Math.max(0, bufferCapacity - 4));
                for (let i = 1; i <= totalPkts; i++) {
                    const seq = startSeq + i - 1;
                    if (i <= deliveredLimit && deliveredLimit > 0) {
                        packetsTrack.push({ seq: seq, status: 'delivered' });
                    } else {
                        packetsTrack.push({ seq: seq, status: 'lost' });
                    }
                    acksTrack.push({ ack: 'TIMEOUT', isDup: false, isMissing: true });
                }
            } else {
                for (let i = 1; i <= totalPkts; i++) {
                    const seq = startSeq + i - 1;
                    packetsTrack.push({ seq: seq, status: 'delivered' });
                    acksTrack.push({ ack: `ACK ${seq}`, isDup: false });
                }
            }

            const nextCwnd = (idx < trajectory.length - 1) ? trajectory[idx + 1].cwnd : t.cwnd;
            const nextSsthresh = (idx < trajectory.length - 1) ? trajectory[idx + 1].ssthresh : t.ssthresh;
            const roundLabel = t.roundLabel || (isLoss 
                ? `Round ${t.r} (${t.lossType === 'timeout' ? 'Time-out Loss' : '3-DupACK Loss'})` 
                : (t.r === 0 ? 'Initial Setup' : `Round ${t.r}`));

            // Construct multi-stage events matching exact real-time animation phases
            const events = [];
            if (t.r === 0) {
                events.push({
                    type: 'slowstart',
                    text: `Initial state: cwnd = ${t.cwnd} MSS, threshold ssthresh = ${t.ssthresh} MSS`
                });
            } else {
                // 1. Transmission in flight
                events.push({
                    type: 'transmit',
                    text: `📤 Sender Transmit: Injected ${t.cwnd} packet${t.cwnd > 1 ? 's' : ''} [Seq #${startSeq}–#${endSeq}] into forward channel`
                });

                // 2. Bottleneck router queue / transit
                if (isLoss && t.lossType === 'timeout') {
                    events.push({
                        type: 'loss',
                        text: `🚨 Router Buffer Overflow: Burst exceeded capacity (${t.cwnd} pkts vs ${bufferCapacity} limit). Packets dropped at queue!`
                    });
                } else if (isLoss && t.lossType === '3ack') {
                    const lostSeq = startSeq + (t.lostIndex || Math.min(4, Math.floor(t.cwnd / 2))) - 1;
                    events.push({
                        type: 'loss',
                        text: `⚠️ Router Drop: Packet #${lostSeq} dropped at bottleneck queue. Subsequent packets arrive out-of-order`
                    });
                } else {
                    const qOcc = Math.min(t.cwnd, bufferCapacity);
                    const qPct = Math.round((qOcc / bufferCapacity) * 100);
                    events.push({
                        type: 'router',
                        text: `🔄 Bottleneck Router: Queued ${qOcc}/${bufferCapacity} packets (${qPct}% buffer occupancy)`
                    });
                }

                // 3. Receiver feedback & ACKs
                if (isLoss && t.lossType === 'timeout') {
                    events.push({
                        type: 'loss',
                        text: `⏱️ Coarse Timer Expired: RTO timeout fired without receiving ACKs (link blackout)`
                    });
                } else if (isLoss && t.lossType === '3ack') {
                    events.push({
                        type: 'loss',
                        text: `⚡ Out-of-Order ACKs: Receiver detected gap, returning 3 Duplicate ACKs (Fast Retransmit triggered)`
                    });
                } else {
                    events.push({
                        type: 'receiver',
                        text: `📥 Receiver Cumulative ACKs: Delivered ${t.cwnd} packets in order, returning ${t.cwnd} ACKs to sender`
                    });
                }

                // 4. Window & Threshold update
                if (isLoss && t.lossType === 'timeout') {
                    events.push({
                        type: 'loss',
                        text: `⚡ Multiplicative Decrease: Halved ssthresh to ⌊${t.cwnd}/2⌋ = ${nextSsthresh} MSS, reset cwnd to 1 MSS (Slow Start restart)`
                    });
                } else if (isLoss && t.lossType === '3ack') {
                    events.push({
                        type: 'loss',
                        text: `⚡ Fast Retransmit (Tahoe): Halved ssthresh to ⌊${t.cwnd}/2⌋ = ${nextSsthresh} MSS, fast retransmission resumes`
                    });
                } else if (t.phase === 'SLOW START') {
                    events.push({
                        type: 'slowstart',
                        text: `🚀 Slow Start Growth: +1 MSS per ACK (+${t.cwnd} MSS total) → cwnd doubles: ${t.cwnd} → ${nextCwnd} MSS`
                    });
                } else {
                    events.push({
                        type: 'avoidance',
                        text: `📈 Additive Increase: +1/cwnd per ACK (+1 MSS per RTT) → cwnd linearly grows: ${t.cwnd} → ${nextCwnd} MSS`
                    });
                }
            }

            snapshots.push({
                rtt: t.r,
                roundLabel: roundLabel,
                cwnd: t.cwnd,
                nextCwnd: nextCwnd,
                ssthresh: t.ssthresh,
                nextSsthresh: nextSsthresh,
                phase: t.phase,
                packetsSent: t.cwnd,
                packetsDelivered: isLoss ? (t.deliveredCount !== undefined ? t.deliveredCount : 0) : t.cwnd,
                routerQueue: Math.min(t.cwnd, bufferCapacity),
                bufferCapacity: bufferCapacity,
                isLoss: isLoss,
                lossType: t.lossType || null,
                lossReason: t.note,
                renoCwnd: t.renoCwnd !== undefined ? t.renoCwnd : t.cwnd,
                startSeq: startSeq,
                endSeq: endSeq,
                packetsTrack: packetsTrack,
                acksTrack: acksTrack,
                events: events,
                stats: {
                    peakCwnd: Math.max(peakCwnd, t.cwnd),
                    delivered: totalDelivered,
                    losses: lossHistory.length,
                    curSsthresh: t.ssthresh,
                    avgThroughput: (totalDelivered / Math.max(1, t.r)).toFixed(1),
                    goodput: Math.max(60, Math.round(100 - (lossHistory.length * 8))),
                    lossHistory: [...lossHistory]
                }
            });
        });

        return snapshots;
    }

    /**
     * 1. Exact Figure 24.11 from Jacobson 1988 / Forouzan:
     * Full lifecycle with Slow Start, Additive Increase, Timeout, and 3 Duplicate ACKs.
     */
    static generateFigure2411() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Initial state: cwnd = 1 MSS, threshold = 16 MSS' },
            { r: 1, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: 1 pkt sent, 1 ACK received (+1 MSS). cwnd doubles: 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: 2 pkts sent, 2 ACKs received (+2 MSS). cwnd doubles: 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: 4 pkts sent, 4 ACKs received (+4 MSS). cwnd doubles: 4 → 8 MSS' },
            { r: 4, cwnd: 8, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Threshold Hit)', note: 'SS RTT 4: 8 pkts sent, 8 ACKs received (+8 MSS). cwnd reaches Threshold = 16 MSS' },
            { r: 5, cwnd: 16, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 5 (Additive Increase)', note: 'AI RTT 5: Additive Increase begins (+1 MSS/RTT): 16 → 17 MSS' },
            { r: 6, cwnd: 17, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Additive Increase)', note: 'AI RTT 6: Linear increase: 17 → 18 MSS' },
            { r: 7, cwnd: 18, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 7 (Additive Increase)', note: 'AI RTT 7: Linear increase: 18 → 19 MSS' },
            { r: 8, cwnd: 19, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 8 (Congestion Avoidance)', note: 'AI RTT 8: cwnd reaches 20 MSS' },
            { r: 8, cwnd: 20, ssthresh: 16, phase: 'LOSS', isLoss: true, lossType: 'timeout', roundLabel: 'Round 8 (Time-out Event)', note: '🚨 Time-out! RTO timer expired. MD: ssthresh = 20/2 = 10 MSS, cwnd crushed to 1 MSS' },
            { r: 9, cwnd: 1, ssthresh: 10, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 9 (SS Restart)', note: 'SS RTT 9: Slow Start restarts with new Threshold = 10 MSS' },
            { r: 10, cwnd: 2, ssthresh: 10, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 10 (Slow Start)', note: 'SS RTT 10: cwnd doubles: 2 → 4 MSS' },
            { r: 11, cwnd: 4, ssthresh: 10, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 11 (Slow Start)', note: 'SS RTT 11: cwnd doubles: 4 → 8 MSS' },
            { r: 12, cwnd: 8, ssthresh: 10, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 12 (Threshold Hit)', note: 'SS RTT 12: cwnd reaches new Threshold = 10 MSS' },
            { r: 13, cwnd: 10, ssthresh: 10, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 13 (Additive Increase)', note: 'AI RTT 13: Additive Increase resumes: 10 → 11 MSS' },
            { r: 14, cwnd: 11, ssthresh: 10, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 14 (Congestion Avoidance)', note: 'AI RTT 14: Linear increase: 11 → 12 MSS' },
            { r: 14, cwnd: 12, ssthresh: 10, phase: 'LOSS', isLoss: true, lossType: '3ack', lostIndex: 4, roundLabel: 'Round 14 (3 Duplicate ACKs)', note: '⚡ 3 ACKs (DupACKs)! MD: ssthresh = 12/2 = 6 MSS, Fast Retransmit resumes directly into AI at cwnd = 6' },
            { r: 15, cwnd: 6, ssthresh: 6, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 15 (AI Resumes)', note: 'AI RTT 15: Additive Increase resumes at cwnd = 6 MSS, increments to 7 MSS' },
            { r: 16, cwnd: 7, ssthresh: 6, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 16 (Additive Increase)', note: 'AI RTT 16: Additive Increase continues: 7 → 8 MSS' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 24, 20);
    }

    /**
     * 2. Figure 24.8: Slow Start Exponential Doubling Deep Dive (2x growth per RTT)
     */
    static generateSlowStartExponential() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Figure 24.8: Initial state cwnd = 1 MSS, high threshold ssthresh = 32 MSS' },
            { r: 1, cwnd: 1, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: '🚀 SS RTT 1: 1 pkt sent, 1 ACK received (+1 MSS). cwnd doubles: 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: '🚀 SS RTT 2: 2 pkts sent, 2 ACKs received (+2 MSS). cwnd doubles: 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: '🚀 SS RTT 3: 4 pkts sent, 4 ACKs received (+4 MSS). cwnd doubles: 4 → 8 MSS' },
            { r: 4, cwnd: 8, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Slow Start)', note: '🚀 SS RTT 4: 8 pkts sent, 8 ACKs received (+8 MSS). cwnd doubles: 8 → 16 MSS' },
            { r: 5, cwnd: 16, ssthresh: 32, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 5 (Slow Start)', note: '🚀 SS RTT 5: 16 pkts sent, 16 ACKs received (+16 MSS). cwnd doubles: 16 → 32 MSS' },
            { r: 6, cwnd: 32, ssthresh: 32, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Threshold Reached)', note: '⚖️ Threshold Reached: cwnd = 32 ≥ ssthresh = 32. Slow Start finishes, transitioning to Congestion Avoidance (+1 MSS/RTT)' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 32, 32);
    }

    /**
     * 3. Figure 24.9: Congestion Avoidance Additive Increase Deep Dive (+1 MSS per RTT)
     */
    static generateCongestionAvoidanceLinear() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 4, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Figure 24.9: Initial state cwnd = 1 MSS, low threshold ssthresh = 4 MSS' },
            { r: 1, cwnd: 1, ssthresh: 4, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 4, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Threshold Hit)', note: 'SS RTT 2: cwnd reaches threshold ssthresh = 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 3 (Additive Increase)', note: '⚖️ Entered Congestion Avoidance (AI). Each ACK adds 1/cwnd MSS, yielding +1 MSS per RTT: 4 → 5 MSS' },
            { r: 4, cwnd: 5, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 4 (Additive Increase)', note: '📈 AI RTT 4: Linear increase +1 MSS: 5 → 6 MSS' },
            { r: 5, cwnd: 6, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 5 (Additive Increase)', note: '📈 AI RTT 5: Linear increase +1 MSS: 6 → 7 MSS' },
            { r: 6, cwnd: 7, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Additive Increase)', note: '📈 AI RTT 6: Linear increase +1 MSS: 7 → 8 MSS' },
            { r: 7, cwnd: 8, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 7 (Additive Increase)', note: '📈 AI RTT 7: Linear increase +1 MSS: 8 → 9 MSS' },
            { r: 8, cwnd: 9, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 8 (Additive Increase)', note: '📈 AI RTT 8: Linear increase +1 MSS: 9 → 10 MSS' },
            { r: 9, cwnd: 10, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 9 (Additive Increase)', note: '📈 AI RTT 9: Linear increase +1 MSS: 10 → 11 MSS' },
            { r: 10, cwnd: 11, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 10 (Additive Increase)', note: '📈 AI RTT 10: Linear increase +1 MSS: 11 → 12 MSS' },
            { r: 11, cwnd: 12, ssthresh: 4, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 11 (Additive Increase)', note: '📈 AI RTT 11: Linear increase +1 MSS: 12 → 13 MSS' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 24, 14);
    }

    /**
     * 4. Mild Congestion: 3 Duplicate ACKs & Fast Retransmit (Packets 1-7, Miss #4)
     */
    static generateFastRetransmit3Ack() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Fast Retransmit Scenario: cwnd = 1, ssthresh = 12 MSS' },
            { r: 1, cwnd: 1, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: cwnd doubles 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Probing Link)', note: 'SS RTT 3: cwnd increases 4 → 7 MSS (probing capacity)' },
            { r: 4, cwnd: 7, ssthresh: 12, phase: 'LOSS', isLoss: true, lossType: '3ack', lostIndex: 4, roundLabel: 'Round 4 (3 Duplicate ACKs)', note: '⚠️ Packet #4 LOST in transit! Packets #5, #6, #7 arrive out of order, generating 3 Duplicate ACKs (ACK 3). Fast Retransmit triggered!' },
            { r: 5, cwnd: 1, ssthresh: 3, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 5 (Fast Retransmit)', note: '🚀 FAST RETRANSMIT: Tahoe cuts ssthresh = ⌊7/2⌋ = 3 MSS, resets cwnd = 1. Retransmits missing packet #4 immediately!' },
            { r: 6, cwnd: 2, ssthresh: 3, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 6 (Cumulative ACK)', note: 'Cumulative ACK for packet #7 arrives! cwnd doubles 1 → 2 MSS' },
            { r: 7, cwnd: 3, ssthresh: 3, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 7 (Threshold Hit)', note: 'Threshold 3 reached: Protocol transitions into Congestion Avoidance' },
            { r: 8, cwnd: 4, ssthresh: 3, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 8 (Additive Increase)', note: 'AI RTT 8: Additive Increase +1 MSS: 3 → 4 MSS' },
            { r: 9, cwnd: 5, ssthresh: 3, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 9 (Additive Increase)', note: 'AI RTT 9: Additive Increase +1 MSS: 4 → 5 MSS' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 16, 7);
    }

    /**
     * 5. Severe Blackout: Dead Link & Retransmission Timeout (RTO Timer)
     */
    static generateSevereTimeoutRto() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Severe Blackout Scenario: cwnd = 1, ssthresh = 16 MSS' },
            { r: 1, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: cwnd doubles 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: cwnd doubles 4 → 8 MSS' },
            { r: 4, cwnd: 8, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Threshold Hit)', note: 'SS RTT 4: cwnd reaches threshold 16 MSS' },
            { r: 5, cwnd: 16, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 5 (Additive Increase)', note: 'AI RTT 5: Congestion Avoidance begins: 16 → 17 MSS' },
            { r: 6, cwnd: 17, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Congestion Avoidance)', note: 'AI RTT 6: Additive Increase: 17 → 18 MSS' },
            { r: 6, cwnd: 18, ssthresh: 16, phase: 'LOSS', isLoss: true, lossType: 'timeout', deliveredCount: 0, roundLabel: 'Round 6 (Severe Blackout Loss)', note: '🚨 TOTAL BLACKOUT: All packets / ACKs lost! Zero ACKs arrive. RTO timer expires! Threshold halved: ssthresh = 18/2 = 9 MSS. cwnd crushed to 1 MSS.' },
            { r: 7, cwnd: 1, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 7 (SS Restart)', note: 'SS RTT 7: Slow Start restarts after coarse timeout: cwnd = 1 MSS' },
            { r: 8, cwnd: 2, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 8 (Slow Start)', note: 'SS RTT 8: cwnd doubles 1 → 2 MSS' },
            { r: 9, cwnd: 4, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 9 (Slow Start)', note: 'SS RTT 9: cwnd doubles 2 → 4 MSS' },
            { r: 10, cwnd: 8, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 10 (Slow Start)', note: 'SS RTT 10: cwnd doubles 4 → 8 MSS (approaching new threshold 9)' },
            { r: 11, cwnd: 9, ssthresh: 9, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 11 (Threshold Hit)', note: 'AI RTT 11: Threshold 9 reached: resumes Congestion Avoidance (+1 MSS/RTT)' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 20, 18);
    }

    /**
     * 6. Router Bottleneck: Tail Drop Queue Overflow Oscillations
     */
    static generateBufferOverflowTailDrop() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Router Bottleneck: Small Router Buffer = 10 packets, ssthresh = 12 MSS' },
            { r: 1, cwnd: 1, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: cwnd doubles 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: cwnd doubles 4 → 8 MSS' },
            { r: 4, cwnd: 8, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Approaching Limit)', note: 'SS RTT 4: cwnd reaches 10 MSS. Router queue is 10/10 full!' },
            { r: 5, cwnd: 10, ssthresh: 12, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 5 (Buffer Saturated)', note: '⚠️ Queue at 100% capacity (10/10 pkts). Next burst will exceed router buffer!' },
            { r: 5, cwnd: 11, ssthresh: 12, phase: 'LOSS', isLoss: true, lossType: '3ack', lostIndex: 11, roundLabel: 'Round 5 (Tail Drop Overflow)', note: '🚨 TAIL DROP / BUFFER OVERFLOW: cwnd (11) exceeded Buffer (10). Packet #11 dropped at router queue! ssthresh = ⌊11/2⌋ = 5 MSS, cwnd → 1 MSS.' },
            { r: 6, cwnd: 1, ssthresh: 5, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 6 (SS Restart)', note: 'SS RTT 6: Slow Start restarts after buffer overflow drop' },
            { r: 7, cwnd: 2, ssthresh: 5, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 7 (Slow Start)', note: 'SS RTT 7: cwnd doubles 1 → 2 MSS' },
            { r: 8, cwnd: 4, ssthresh: 5, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 8 (Slow Start)', note: 'SS RTT 8: cwnd doubles 2 → 4 MSS' },
            { r: 9, cwnd: 5, ssthresh: 5, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 9 (Threshold Hit)', note: 'Threshold 5 reached: AI resumes: 5 → 6 MSS' },
            { r: 10, cwnd: 6, ssthresh: 5, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 10 (Additive Increase)', note: 'AI RTT 10: Linear increase: 6 → 7 MSS' },
            { r: 11, cwnd: 7, ssthresh: 5, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 11 (Additive Increase)', note: 'AI RTT 11: Linear increase: 7 → 8 MSS' },
            { r: 12, cwnd: 8, ssthresh: 5, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 12 (Additive Increase)', note: 'AI RTT 12: Linear increase: 8 → 9 MSS' },
            { r: 13, cwnd: 9, ssthresh: 5, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 13 (Buffer Saturated)', note: 'AI RTT 13: Linear increase: 9 → 10 MSS (Buffer saturated again!)' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 10, 11);
    }

    /**
     * 7. Tahoe vs Reno Showdown: Fast Recovery vs Slow Start Penalty
     */
    static generateTahoeVsReno() {
        const trajectory = [
            { r: 0, cwnd: 1, renoCwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Tahoe vs Reno Showdown: Both start at cwnd = 1, ssthresh = 16 MSS' },
            { r: 1, cwnd: 1, renoCwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: Both double 1 → 2 MSS' },
            { r: 2, cwnd: 2, renoCwnd: 2, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: Both double 2 → 4 MSS' },
            { r: 3, cwnd: 4, renoCwnd: 4, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: Both double 4 → 8 MSS' },
            { r: 4, cwnd: 8, renoCwnd: 8, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Threshold Hit)', note: 'SS RTT 4: Both reach threshold 16 MSS' },
            { r: 5, cwnd: 16, renoCwnd: 16, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 5 (Additive Increase)', note: 'AI RTT 5: Both enter Congestion Avoidance: 16 → 17 MSS' },
            { r: 6, cwnd: 17, renoCwnd: 17, ssthresh: 16, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Congestion Avoidance)', note: 'AI RTT 6: Both in AI: 17 → 18 MSS' },
            { r: 6, cwnd: 18, renoCwnd: 18, ssthresh: 16, phase: 'LOSS', isLoss: true, lossType: '3ack', lostIndex: 12, roundLabel: 'Round 6 (3 DupACKs Comparison)', note: '⚡ 3 DUPLICATE ACKs! Tahoe resets cwnd to 1 MSS (Slow Start penalty). Reno sets cwnd = ssthresh = 9 MSS (Fast Recovery)!' },
            { r: 7, cwnd: 1, renoCwnd: 9, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 7 (Recovery Divergence)', note: 'RTT 7: Tahoe crawls at cwnd = 1 MSS. Reno maintains high speed at cwnd = 9 MSS!' },
            { r: 8, cwnd: 2, renoCwnd: 10, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 8 (Tahoe SS vs Reno AI)', note: 'RTT 8: Tahoe doubles to 2 MSS. Reno linearly increases to 10 MSS (+1 MSS)' },
            { r: 9, cwnd: 4, renoCwnd: 11, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 9 (Tahoe SS vs Reno AI)', note: 'RTT 9: Tahoe doubles to 4 MSS. Reno linearly increases to 11 MSS' },
            { r: 10, cwnd: 8, renoCwnd: 12, ssthresh: 9, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 10 (Tahoe SS vs Reno AI)', note: 'RTT 10: Tahoe doubles to 8 MSS. Reno increases to 12 MSS' },
            { r: 11, cwnd: 9, renoCwnd: 13, ssthresh: 9, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 11 (Tahoe Reaches Thresh)', note: 'RTT 11: Tahoe reaches threshold 9. Reno continues at 13 MSS. Notice Reno delivered ~40% more data!' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 20, 18);
    }

    /**
     * 8. Transient Wireless Loss: False Congestion Collapse Penalty
     */
    static generateRandomWirelessLoss() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'Wireless Link Scenario: High capacity (buffer = 20), low window cwnd = 1' },
            { r: 1, cwnd: 1, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: cwnd doubles 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 16, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: cwnd increases to 6 MSS' },
            { r: 4, cwnd: 6, ssthresh: 16, phase: 'LOSS', isLoss: true, lossType: '3ack', lostIndex: 3, roundLabel: 'Round 4 (Transient Wireless Loss)', note: '📶 TRANSIENT WIRELESS LOSS: Single bit error drops packet #3 (buffer was only 30% full!). 3 Dup ACKs occur.' },
            { r: 5, cwnd: 1, ssthresh: 3, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 5 (False Collapse Penalty)', note: '❌ FALSE CONGESTION PENALTY: TCP Tahoe mistakenly assumes congestion collapse! Slashes ssthresh = 3 MSS and resets cwnd = 1, crippling throughput.' },
            { r: 6, cwnd: 2, ssthresh: 3, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 6 (Slow Start)', note: 'SS RTT 6: Retransmission successful, cwnd doubles 1 → 2 MSS' },
            { r: 7, cwnd: 3, ssthresh: 3, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 7 (Threshold Hit)', note: 'AI RTT 7: Early threshold reached, slow linear increase resumes: 3 → 4 MSS' },
            { r: 8, cwnd: 4, ssthresh: 3, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 8 (Additive Increase)', note: 'AI RTT 8: Additive Increase: 4 → 5 MSS' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 20, 6);
    }

    /**
     * 9. High BDP Pipe: Long Fat Network (Deep Buffer Pipeline)
     */
    static generateHighBdpPipe() {
        const trajectory = [
            { r: 0, cwnd: 1, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Initial Setup', note: 'High BDP Long Fat Network: Large buffer = 28 packets, ssthresh = 20 MSS' },
            { r: 1, cwnd: 1, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 1 (Slow Start)', note: 'SS RTT 1: cwnd doubles 1 → 2 MSS' },
            { r: 2, cwnd: 2, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 2 (Slow Start)', note: 'SS RTT 2: cwnd doubles 2 → 4 MSS' },
            { r: 3, cwnd: 4, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 3 (Slow Start)', note: 'SS RTT 3: cwnd doubles 4 → 8 MSS' },
            { r: 4, cwnd: 8, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 4 (Slow Start)', note: 'SS RTT 4: cwnd doubles 8 → 16 MSS' },
            { r: 5, cwnd: 16, ssthresh: 20, phase: 'SLOW START', isLoss: false, roundLabel: 'Round 5 (Threshold Hit)', note: 'SS RTT 5: High-speed pipe filling: cwnd reaches threshold 20 MSS' },
            { r: 6, cwnd: 20, ssthresh: 20, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 6 (Additive Increase)', note: 'AI RTT 6: Enters Congestion Avoidance with 20 MSS in flight: 20 → 21 MSS' },
            { r: 7, cwnd: 21, ssthresh: 20, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 7 (Additive Increase)', note: 'AI RTT 7: Deep pipeline sustained: 21 → 22 MSS' },
            { r: 8, cwnd: 22, ssthresh: 20, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 8 (Additive Increase)', note: 'AI RTT 8: Deep pipeline sustained: 22 → 23 MSS' },
            { r: 9, cwnd: 23, ssthresh: 20, phase: 'CONGESTION AVOIDANCE', isLoss: false, roundLabel: 'Round 9 (Additive Increase)', note: 'AI RTT 9: Deep pipeline sustained: 23 → 24 MSS' }
        ];
        return this.buildSnapshotsFromTrajectory(trajectory, 28, 24);
    }
}

// ============================================================================
// 2. Figure 24.11 Authentic Chart Canvas Renderer
// ============================================================================

class SawtoothChartRenderer {
    constructor(canvas, tooltipEl) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tooltipEl = tooltipEl;
        this.snapshots = [];
        this.currentRtt = 0;
        this.showReno = false;
        this.pulseAngle = 0;
        this.hoveredRtt = null;

        this.setupDPI();
        this.bindEvents();

        if (window.ResizeObserver && this.canvas.parentElement) {
            this.resizeObserver = new ResizeObserver(() => {
                this.setupDPI();
                this.draw();
            });
            this.resizeObserver.observe(this.canvas.parentElement);
        }
    }

    setupDPI() {
        const dpr = window.devicePixelRatio || 1;
        const parent = this.canvas.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
        const w = Math.max(300, Math.round(rect.width || 700));
        const h = Math.max(160, Math.round(rect.height || 220));
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        this.width = w;
        this.height = h;
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const padLeft = 48;
            const padRight = 36;
            const plotW = this.width - padLeft - padRight;
            const maxRtt = Math.max(8, this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].rtt : 16);

            if (mouseX >= padLeft && mouseX <= this.width - padRight && this.snapshots.length > 0) {
                const ratio = (mouseX - padLeft) / plotW;
                const closestIdx = Math.round(ratio * (this.snapshots.length - 1));
                if (closestIdx >= 0 && closestIdx < this.snapshots.length) {
                    this.hoveredRtt = closestIdx;
                    this.showTooltip(closestIdx, e.clientX, e.clientY);
                    this.draw();
                    return;
                }
            }
            this.hideTooltip();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    showTooltip(idx, clientX, clientY) {
        if (!this.tooltipEl || !this.snapshots[idx]) return;
        const s = this.snapshots[idx];
        const rect = this.canvas.getBoundingClientRect();

        let actionText = s.phase === 'SLOW START' ? 'SS: Exponential (2×)' : 'AI: Additive Increase (+1 MSS)';
        if (s.isLoss) actionText = s.lossType === 'timeout' ? 'Time-out: cwnd resets to 1 (SS)' : '3 ACKs: cwnd = ssthresh (AI)';

        const roundTitle = s.roundLabel || `Round ${s.rtt}`;
        this.tooltipEl.innerHTML = `
            <div style="font-weight:700; color:#38bdf8; margin-bottom:3px;">${roundTitle}</div>
            <div>cwnd: <strong style="color:#ffffff;">${s.cwnd} MSS</strong></div>
            <div>Threshold: <strong style="color:#c084fc;">${s.ssthresh} MSS</strong></div>
            <div>Phase: <span style="color:${s.isLoss ? '#f43f5e' : (s.phase === 'SLOW START' ? '#38bdf8' : '#f59e0b')}; font-weight:700;">${s.phase}</span></div>
            ${this.showReno ? `<div>Reno cwnd: <strong style="color:#a855f7;">${s.renoCwnd || s.cwnd} MSS</strong></div>` : ''}
            <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${actionText}</div>
        `;

        this.tooltipEl.style.left = `${clientX - rect.left}px`;
        this.tooltipEl.style.top = `${clientY - rect.top}px`;
        this.tooltipEl.classList.remove('hidden');
    }

    hideTooltip() {
        if (this.tooltipEl) this.tooltipEl.classList.add('hidden');
        if (this.hoveredRtt !== null) {
            this.hoveredRtt = null;
            this.draw();
        }
    }

    setData(snapshots, currentRtt, showReno = false) {
        this.snapshots = snapshots;
        this.currentRtt = currentRtt;
        this.showReno = showReno;
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        this.pulseAngle += 0.08;

        if (!this.snapshots || this.snapshots.length === 0) return;

        const padLeft = 48;
        const padRight = 36;
        const padTop = 26;
        const padBottom = 42;

        const plotW = this.width - padLeft - padRight;
        const plotH = this.height - padTop - padBottom;

        const peakInSnapshots = Math.max(
            ...this.snapshots.map(s => Math.max(s.cwnd, s.ssthresh || 0, this.showReno ? (s.renoCwnd || 0) : 0))
        );
        const maxCwnd = Math.max(20, Math.ceil((peakInSnapshots + 2) / 4) * 4);
        const maxRtt = Math.max(8, this.snapshots[this.snapshots.length - 1].rtt);

        const getX = (rtt) => padLeft + (rtt / maxRtt) * plotW;
        const getY = (val) => padTop + plotH - (val / maxCwnd) * plotH;

        // 1. Subtle, elegant background zones for Slow Start vs Congestion Avoidance
        for (let i = 0; i < this.snapshots.length - 1; i++) {
            const s = this.snapshots[i];
            const nextS = this.snapshots[i + 1];
            const x1 = getX(s.rtt);
            const x2 = getX(nextS.rtt);
            if (x2 <= x1) continue;

            ctx.save();
            ctx.fillStyle = (s.phase === 'SLOW START')
                ? 'rgba(56, 189, 248, 0.045)'
                : 'rgba(250, 204, 21, 0.04)';
            ctx.fillRect(x1, padTop, x2 - x1, plotH);
            ctx.restore();
        }

        // 2. Y-Axis Grid Lines & Values
        ctx.save();
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const stepY = maxCwnd > 24 ? 4 : 2;
        for (let yVal = 0; yVal <= maxCwnd; yVal += stepY) {
            const y = getY(yVal);
            ctx.beginPath();
            ctx.strokeStyle = yVal === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = yVal === 0 ? 1.5 : 1;
            ctx.moveTo(padLeft, y);
            ctx.lineTo(this.width - padRight, y);
            ctx.stroke();

            ctx.fillStyle = yVal === 0 ? '#cbd5e1' : '#94a3b8';
            ctx.fillText(`${yVal}`, padLeft - 8, y);
        }

        // Y-Axis Title
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText('cwnd (MSS)', padLeft - 40, padTop - 12);
        ctx.restore();

        // 3. X-Axis Grid Lines, Ticks, and Round Labels
        ctx.save();
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let r = 0; r <= maxRtt; r++) {
            const x = getX(r);
            // Vertical grid line
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            ctx.moveTo(x, padTop);
            ctx.lineTo(x, padTop + plotH);
            ctx.stroke();

            // Bottom tick mark
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1.2;
            ctx.moveTo(x, padTop + plotH);
            ctx.lineTo(x, padTop + plotH + 4);
            ctx.stroke();

            // Round number label
            const showLabel = maxRtt <= 18 || r % 2 === 0 || r === maxRtt;
            if (showLabel) {
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`${r}`, x, padTop + plotH + 7);
            }
        }

        // X-Axis Title
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText('Round (RTT)', this.width - padRight, padTop + plotH + 22);
        ctx.restore();

        // 4. Threshold Line (ssthresh)
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        for (let i = 0; i <= this.currentRtt; i++) {
            const s = this.snapshots[i];
            const px = getX(s.rtt);
            const py = getY(s.ssthresh);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // 5. Reno Comparison Curve (if enabled)
        if (this.showReno) {
            ctx.save();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let i = 0; i <= this.currentRtt; i++) {
                const s = this.snapshots[i];
                const px = getX(s.rtt);
                const py = getY(s.renoCwnd || s.cwnd);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();

            for (let i = 0; i <= this.currentRtt; i++) {
                const s = this.snapshots[i];
                const px = getX(s.rtt);
                const py = getY(s.renoCwnd || s.cwnd);
                ctx.save();
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#a855f7';
                ctx.fill();
                ctx.restore();
            }
        }

        // 6. TCP Tahoe Curve (Figure 24.11 Pink Line)
        for (let i = 0; i < this.currentRtt; i++) {
            const s1 = this.snapshots[i];
            const s2 = this.snapshots[i + 1];

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(getX(s1.rtt), getY(s1.cwnd));
            ctx.lineTo(getX(s2.rtt), getY(s2.cwnd));
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(236, 72, 153, 0.4)';
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.restore();

            // If s2 was a loss event, draw the vertical drop line down to nextCwnd
            if (s2.isLoss) {
                const dropX = getX(s2.rtt);
                const dropFromY = getY(s2.cwnd);
                const dropToY = getY(s2.nextCwnd);

                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = '#f43f5e';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(dropX, dropFromY);
                ctx.lineTo(dropX, dropToY);
                ctx.stroke();
                ctx.restore();
            }
        }

        // If current round IS a loss event, draw its vertical drop line as well
        const curSnap = this.snapshots[this.currentRtt];
        if (curSnap && curSnap.isLoss) {
            const dropX = getX(curSnap.rtt);
            const dropFromY = getY(curSnap.cwnd);
            const dropToY = getY(curSnap.nextCwnd);

            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(dropX, dropFromY);
            ctx.lineTo(dropX, dropToY);
            ctx.stroke();
            ctx.restore();
        }

        // 7. Data Points / Dots
        for (let i = 0; i <= this.currentRtt; i++) {
            const s = this.snapshots[i];
            const px = getX(s.rtt);
            const py = getY(s.cwnd);

            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, s.isLoss ? 5.5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = s.isLoss ? '#f43f5e' : '#0f172a';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = s.isLoss ? '#ffffff' : '#ec4899';
            ctx.stroke();
            ctx.restore();
        }

        // 8. Loss Event Badges & MD Label (Collision-Free, Above Peak)
        for (let i = 0; i <= this.currentRtt; i++) {
            const s = this.snapshots[i];
            if (!s.isLoss) continue;

            const px = getX(s.rtt);
            const py = getY(s.cwnd);
            const dropToY = getY(s.nextCwnd);

            // Badge above peak
            const label = s.lossType === 'timeout' ? '🚨 Time-out' : '⚡ 3-DupACK';
            ctx.save();
            ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
            const textWidth = ctx.measureText(label).width;
            const badgeW = textWidth + 14;
            const badgeH = 18;
            const badgeX = px - badgeW / 2;
            const badgeY = Math.max(padTop - 8, py - 26);

            ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, px, badgeY + badgeH / 2);
            ctx.restore();

            // MD label beside vertical drop line
            ctx.save();
            ctx.font = '700 9px "JetBrains Mono", monospace';
            ctx.fillStyle = '#fca5a5';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`MD: ↓${s.nextCwnd}`, px + 8, (py + dropToY) / 2);
            ctx.restore();
        }

        // 9. Active Point Radar Ping
        if (this.snapshots[this.currentRtt]) {
            const cur = this.snapshots[this.currentRtt];
            const cx = getX(cur.rtt);
            const cy = getY(cur.cwnd);

            ctx.save();
            const pulseR = 7 + (Math.sin(this.pulseAngle) + 1) * 4;
            ctx.beginPath();
            ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = cur.isLoss ? '#f43f5e' : '#ec4899';
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.6;
            ctx.stroke();

            // Label
            ctx.globalAlpha = 1.0;
            ctx.font = '700 10.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const labelY = cur.isLoss ? cy - 30 : cy - 10;
            ctx.fillText(`${cur.cwnd} MSS`, cx, labelY);
            ctx.restore();
        }
    }
}

// ============================================================================
// 3. Pipeline & Cumulative ACK Animation Renderer
// ============================================================================

class PipeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.snapshot = null;
        this.progress = 1.0;
        this.animTime = 0;
        this.isTransitActive = false;

        this.setupDPI();

        if (window.ResizeObserver && this.canvas.parentElement) {
            this.resizeObserver = new ResizeObserver(() => {
                this.setupDPI();
                this.draw();
            });
            this.resizeObserver.observe(this.canvas.parentElement);
        }
    }

    setupDPI() {
        const dpr = window.devicePixelRatio || 1;
        const parent = this.canvas.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
        const w = Math.max(300, Math.round(rect.width || 700));
        const h = Math.max(160, Math.round(rect.height || 220));
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        this.width = w;
        this.height = h;
    }

    setState(snapshot, progress = 1.0, isTransitActive = false) {
        this.snapshot = snapshot;
        this.progress = progress;
        this.isTransitActive = isTransitActive;
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        this.animTime += 0.05;

        if (!this.snapshot) return;

        const midY = this.height / 2;
        const senderX = 35;
        const senderW = 110;
        const receiverW = 110;
        const receiverX = this.width - receiverW - 35;
        const routerX = this.width / 2;

        const forwardPipeY = midY - 34;
        const ackPipeY = midY + 34;

        this.drawChannels(senderX + senderW, receiverX, forwardPipeY, ackPipeY);
        this.drawSenderStation(senderX, midY - 50, senderW, 100);
        this.drawReceiverStation(receiverX, midY - 50, receiverW, 100);
        this.drawRouterRack(routerX, midY, this.snapshot.routerQueue, this.snapshot.bufferCapacity, this.snapshot.isLoss, this.snapshot.lossType);

        // Only draw moving dots when animation is actively running
        if (this.isTransitActive && this.progress < 1.0) {
            this.drawActiveTransit(senderX + senderW, routerX, receiverX, forwardPipeY, ackPipeY);
        } else {
            this.drawIdleState(senderX + senderW, receiverX, forwardPipeY, ackPipeY);
        }
    }

    drawChannels(fromX, toX, forwardY, ackY) {
        const ctx = this.ctx;
        ctx.save();
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.moveTo(fromX, forwardY);
        ctx.lineTo(toX, forwardY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, ackY);
        ctx.lineTo(fromX, ackY);
        ctx.stroke();

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('DATA PACKETS ────────▶', (fromX + toX) / 2, forwardY - 14);

        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.fillText('◀──────── CUMULATIVE ACKs', (fromX + toX) / 2, ackY + 22);
        ctx.restore();
    }

    drawSenderStation(x, y, w, h) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#0c4a6e';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('SENDER', x + w / 2, y + 20);

        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`cwnd: ${this.snapshot.cwnd} MSS`, x + w / 2, y + 42);

        // Render dynamic sliding window slots matching cwnd
        const cwnd = this.snapshot.cwnd;
        const maxDisplay = 12;
        const count = Math.min(cwnd, maxDisplay);
        const slotW = count <= 6 ? 9 : (count <= 9 ? 6.5 : 5);
        const gap = 2;
        const totalW = count * (slotW + gap) - gap;
        const startX = x + w / 2 - totalW / 2;

        for (let i = 0; i < count; i++) {
            ctx.beginPath();
            ctx.roundRect(startX + i * (slotW + gap), y + 54, slotW, 16, 1.5);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
        }

        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        if (cwnd > maxDisplay) {
            ctx.fillText(`+${cwnd - maxDisplay} more in flight`, x + w / 2, y + 84);
        } else {
            ctx.fillText(`Seq #${this.snapshot.startSeq}–#${this.snapshot.endSeq}`, x + w / 2, y + 88);
        }
        ctx.restore();
    }

    drawReceiverStation(x, y, w, h) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('RECEIVER', x + w / 2, y + 20);

        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#10b981';
        ctx.fillText(`ACK: #${this.snapshot.stats.delivered}`, x + w / 2, y + 42);

        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(`RcvNxt: #${this.snapshot.endSeq + 1}`, x + w / 2, y + 68);

        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Cumulative In-Order', x + w / 2, y + 88);
        ctx.restore();
    }

    drawRouterRack(cx, cy, occupied, capacity, isLoss, lossType) {
        const ctx = this.ctx;
        const slotW = capacity > 20 ? 4.2 : 5.0;
        const slotH = 18;
        const gap = capacity > 20 ? 2.0 : 2.5;
        const totalW = capacity * (slotW + gap) - gap;

        // Dynamically scale width to ALWAYS contain all capacity slots with at least 20px padding on each side
        const w = Math.max(150, totalW + 40);
        const h = 86;
        const rx = cx - w / 2;
        const ry = cy - h / 2;

        // Only show overflow red styling when buffer is ACTUALLY full
        const isOverflow = isLoss && lossType === 'timeout' && occupied >= capacity;
        const isTimeout = isLoss && lossType === 'timeout' && occupied < capacity;
        const isDupAckDrop = isLoss && lossType === '3ack';

        ctx.save();
        ctx.fillStyle = isOverflow ? '#4c0519' : '#1e293b';
        ctx.strokeStyle = isOverflow ? '#f43f5e' : (isDupAckDrop ? '#f59e0b' : (isTimeout ? '#a855f7' : (occupied >= capacity ? '#f59e0b' : '#6366f1')));
        ctx.lineWidth = 2;
        ctx.shadowColor = isOverflow ? 'rgba(244, 63, 94, 0.7)' : (isDupAckDrop ? 'rgba(245, 158, 11, 0.4)' : (isTimeout ? 'rgba(168, 85, 247, 0.4)' : 'rgba(99, 102, 241, 0.4)'));
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('ROUTER BUFFER', cx, ry + 18);

        const startX = cx - totalW / 2;
        const slotY = ry + 30;

        for (let i = 0; i < capacity; i++) {
            ctx.beginPath();
            ctx.roundRect(startX + i * (slotW + gap), slotY, slotW, slotH, 1.5);
            if (i < occupied) {
                if (isOverflow) {
                    ctx.fillStyle = '#f43f5e';  // Red for overflow
                } else if (isDupAckDrop) {
                    ctx.fillStyle = '#f59e0b';  // Amber for 3-DupACK drop
                } else if (isTimeout) {
                    ctx.fillStyle = '#a855f7';  // Purple for timeout (not overflow)
                } else {
                    ctx.fillStyle = '#38bdf8';  // Normal blue
                }
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; // Empty slot
            }
            ctx.fill();
        }

        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const utilPct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
        if (isOverflow) {
            ctx.fillStyle = '#f43f5e';
            ctx.fillText('🚨 BUFFER OVERFLOW', cx, ry + 70);
        } else if (isDupAckDrop) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`⚠️ PKT DROP (${occupied} / ${capacity} pkts)`, cx, ry + 70);
        } else if (isTimeout) {
            ctx.fillStyle = '#a855f7';
            ctx.fillText(`⏱️ RTO TIMEOUT (${occupied} / ${capacity} pkts)`, cx, ry + 70);
        } else {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`${occupied} / ${capacity} pkts (${utilPct}%)`, cx, ry + 70);
        }
        ctx.restore();
    }

    drawActiveTransit(fromX, routerX, toX, dataY, ackY) {
        const ctx = this.ctx;
        const p = Math.max(0.0, Math.min(1.0, this.progress));
        const packets = (this.snapshot.packetsTrack && this.snapshot.packetsTrack.length > 0)
            ? this.snapshot.packetsTrack
            : Array.from({ length: Math.max(1, this.snapshot.cwnd) }, (_, i) => ({
                seq: this.snapshot.startSeq + i,
                status: (this.snapshot.isLoss && i === this.snapshot.cwnd - 1) ? 'lost' : 'delivered'
            }));

        const acks = (this.snapshot.acksTrack && this.snapshot.acksTrack.length > 0)
            ? this.snapshot.acksTrack
            : packets.map(pkt => ({
                ack: pkt.status === 'lost' ? 'TIMEOUT' : `ACK ${pkt.seq}`,
                isDup: false,
                isMissing: pkt.status === 'lost'
            }));

        const numPackets = packets.length;
        const numAcks = acks.length;
        if (numPackets <= 0) return;

        // Dynamic sizing for packet circles based on total count
        const pktRadius = numPackets > 14 ? 6.0 : (numPackets > 8 ? 6.8 : 7.5);
        const ackRadius = numAcks > 14 ? 5.5 : 6.5;
        const fontSize = numPackets > 14 ? '7px' : '8px';

        // -------------------------------------------------------------
        // Forward transmission: Packets launch from fromX to toX
        // All forward packets finish arrival at receiver (or router drop) by p = 0.46
        // -------------------------------------------------------------
        const spreadPkt = numPackets > 1 ? Math.min(0.20, (numPackets - 1) * 0.02) : 0;
        const flightTimePkt = 0.46 - (0.02 + spreadPkt);

        for (let i = 0; i < numPackets; i++) {
            const pkt = packets[i];
            const launchT = (numPackets === 1) ? 0.02 : 0.02 + (i / (numPackets - 1)) * spreadPkt;
            const arriveT = launchT + flightTimePkt;

            if (p >= launchT && p <= arriveT) {
                const u = (p - launchT) / flightTimePkt; // 0.0 (launch) -> 1.0 (arrive)

                // If packet is marked lost, it travels to router (u < 0.5) and drops down (u >= 0.5)
                if (pkt.status === 'lost') {
                    if (u < 0.5) {
                        const curX = fromX + (routerX - fromX) * (u / 0.5);
                        this.renderPacketDot(ctx, curX, dataY, pktRadius, pkt.seq, fontSize, false);
                    } else {
                        // Drop animation at router
                        const dropU = (u - 0.5) / 0.5; // 0.0 to 1.0
                        const dropY = dataY + dropU * 34;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0.1, 1.0 - dropU * 0.9);
                        ctx.beginPath();
                        ctx.arc(routerX, dropY, pktRadius + 1, 0, Math.PI * 2);
                        ctx.fillStyle = '#f43f5e';
                        ctx.shadowColor = '#f43f5e';
                        ctx.shadowBlur = 12;
                        ctx.fill();

                        ctx.font = '700 7px "JetBrains Mono", monospace';
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('✕', routerX, dropY);
                        ctx.restore();
                    }
                } else {
                    // Packet is delivered normally
                    const curX = fromX + (toX - fromX) * u;
                    this.renderPacketDot(ctx, curX, dataY, pktRadius, pkt.seq, fontSize, false);
                }
            }
        }

        // -------------------------------------------------------------
        // Reverse transmission: ACKs launch from toX back to fromX
        // All ACKs finish arrival at sender at PRECISELY p = 1.0
        // (Or RTO Timer counts down and expires at PRECISELY p = 1.0)
        // -------------------------------------------------------------
        const validAcks = [];
        for (let i = 0; i < numAcks; i++) {
            const ack = acks[i];
            if (!ack.isMissing && ack.ack !== 'TIMEOUT' && !(typeof ack.ack === 'string' && ack.ack.includes('MISSING'))) {
                validAcks.push(ack);
            }
        }

        const numValid = validAcks.length;
        if (numValid > 0) {
            const spreadAck = numValid > 1 ? Math.min(0.20, (numValid - 1) * 0.02) : 0;
            const flightTimeAck = 1.0 - (0.50 + spreadAck);

            for (let k = 0; k < numValid; k++) {
                const ack = validAcks[k];
                const ackLaunchT = (numValid === 1) ? 0.52 : 0.50 + (k / (numValid - 1)) * spreadAck;
                const ackArriveT = (numValid === 1) ? 1.0 : ackLaunchT + flightTimeAck;

                if (p >= ackLaunchT && p <= ackArriveT) {
                    const dur = ackArriveT - ackLaunchT;
                    const u = dur > 0 ? (p - ackLaunchT) / dur : 1.0; // 0.0 -> 1.0
                    const curX = toX - (toX - fromX) * u;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(curX, ackY, ackRadius, 0, Math.PI * 2);
                    ctx.fillStyle = ack.isDup ? '#f59e0b' : '#10b981';
                    ctx.shadowColor = ack.isDup ? '#f59e0b' : '#10b981';
                    ctx.shadowBlur = 10;
                    ctx.fill();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();

                    ctx.font = '700 7px "JetBrains Mono", monospace';
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = ack.isDup ? 'DUP' : 'ACK';
                    ctx.fillText(label, curX, ackY);
                    ctx.restore();
                }
            }
        } else {
            // Severe Timeout Loss: No ACKs returning, render active RTO countdown bar
            if (p >= 0.46) {
                const rtoProgress = Math.min(1.0, (p - 0.46) / 0.54); // 0.0 -> 1.0
                const timerW = 220;
                const timerH = 26;
                const tx = (fromX + toX) / 2 - timerW / 2;
                const ty = ackY - 13;

                ctx.save();
                ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
                ctx.strokeStyle = '#f43f5e';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(tx, ty, timerW, timerH, 6);
                ctx.fill();
                ctx.stroke();

                // Fill bar
                const barFillW = Math.max(0, (timerW - 4) * (1 - rtoProgress));
                if (barFillW > 0) {
                    ctx.fillStyle = 'rgba(244, 63, 94, 0.7)';
                    ctx.beginPath();
                    ctx.roundRect(tx + 2, ty + 2, barFillW, timerH - 4, 4);
                    ctx.fill();
                }

                ctx.font = '700 9.5px "JetBrains Mono", monospace';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const remainingPct = Math.max(0, Math.round((1 - rtoProgress) * 100));
                ctx.fillText(`⏱️ RTO TIMER: ${remainingPct}% (Awaiting ACKs)`, (fromX + toX) / 2, ackY);
                ctx.restore();
            }
        }
    }

    renderPacketDot(ctx, x, y, r, seq, fontSize, isLost) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isLost ? '#f43f5e' : '#38bdf8';
        ctx.shadowColor = isLost ? '#f43f5e' : '#00f2fe';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = `700 ${fontSize} "JetBrains Mono", monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displaySeq = String(seq).length > 3 ? String(seq).slice(0, 3) : String(seq);
        ctx.fillText(displaySeq, x, y);
        ctx.restore();
    }

    drawIdleState(fromX, toX, dataY, ackY) {
        // When simulation is stopped or idle between steps, DO NOT draw moving dots or frozen dots.
        // The pipe is at rest and ready for the next round.
    }
}

// ============================================================================
// 4. Main Simulation & UI Controller
// ============================================================================

class TahoeSimulationController {
    constructor() {
        this.snapshots = [];
        this.currentRtt = 0;
        this.isPlaying = false;
        this.speedMultiplier = 1.0;
        this.baseDuration = 2400;
        this.animTimer = null;
        this.animTargetRtt = null;
        this.forcedLossRtt = null;
        this.showReno = false;

        // UI Controls
        this.ssthreshSlider = document.getElementById('ssthresh-slider');
        this.ssthreshVal = document.getElementById('ssthresh-val');
        this.bufferSlider = document.getElementById('buffer-slider');
        this.bufferVal = document.getElementById('buffer-val');
        this.scenarioSelect = document.getElementById('scenario-select');
        this.renoToggle = document.getElementById('reno-compare-toggle');
        this.legendReno = document.getElementById('legend-reno');
        this.btnAckMiss = document.getElementById('btn-ack-miss');
        this.btnForceLoss = document.getElementById('btn-force-loss');
        this.btnRunSim = document.getElementById('btn-run-sim');

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

        // Sidebar & Inspector
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');
        this.timelineEventsList = document.getElementById('timeline-events-list');
        this.logCountBadge = document.getElementById('log-count-badge');
        this.sidebarContent = document.querySelector('.sidebar-content');

        this.inspCwnd = document.getElementById('insp-cwnd');
        this.inspSsthresh = document.getElementById('insp-ssthresh');
        this.inspPhase = document.getElementById('insp-phase');
        this.inspFormula = document.getElementById('insp-formula');
        this.inspInflight = document.getElementById('insp-inflight');
        this.inspDupacks = document.getElementById('insp-dupacks');
        this.inspBufferOcc = document.getElementById('insp-buffer-occ');
        this.inspBufferUtil = document.getElementById('insp-buffer-util');
        this.inspDrops = document.getElementById('insp-drops');
        this.inspRcvAck = document.getElementById('insp-rcv-ack');
        this.inspRcvLastack = document.getElementById('insp-rcv-lastack');
        this.inspLiveAction = document.getElementById('insp-live-action');

        // Metrics
        this.metricPeakCwnd = document.getElementById('metric-peak-cwnd');
        this.metricDelivered = document.getElementById('metric-delivered');
        this.metricLosses = document.getElementById('metric-losses');
        this.metricCurSsthresh = document.getElementById('metric-cur-ssthresh');
        this.metricThroughput = document.getElementById('metric-throughput');
        this.metricGoodput = document.getElementById('metric-goodput');
        this.lossHistoryList = document.getElementById('loss-history-list');

        // Header & Strips
        this.simStatusText = document.getElementById('sim-status-text');
        this.simStatusBadge = document.getElementById('sim-status-badge');
        this.tahoePhaseBadge = document.getElementById('tahoe-phase-badge');
        this.tahoePhaseText = document.getElementById('tahoe-phase-text');
        this.growthRateFormula = document.getElementById('growth-rate-formula');
        this.pipeLiveStatus = document.getElementById('pipe-live-status');
        this.quickInflight = document.getElementById('quick-inflight');
        this.quickQueue = document.getElementById('quick-queue');
        this.quickDropBadge = document.getElementById('quick-drop-badge');

        this.stripPackets = document.getElementById('strip-packets');
        this.stripAcks = document.getElementById('strip-acks');
        this.phaseRibbonBar = document.getElementById('phase-ribbon-bar');

        this.init();
    }

    init() {
        const chartCanvas = document.getElementById('chart-canvas');
        const chartTooltip = document.getElementById('chart-tooltip');
        const pipeCanvas = document.getElementById('pipe-canvas');

        this.chartRenderer = new SawtoothChartRenderer(chartCanvas, chartTooltip);
        this.pipeRenderer = new PipeRenderer(pipeCanvas);

        this.bindEvents();
        this.setupContinuousAnimation();
        this.runSimulation();
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.chartRenderer.setupDPI();
            this.pipeRenderer.setupDPI();
            this.updateView();
        });

        this.ssthreshSlider.addEventListener('input', (e) => {
            this.ssthreshVal.textContent = `${e.target.value} MSS`;
            this.runSimulation();
        });

        this.bufferSlider.addEventListener('input', (e) => {
            this.bufferVal.textContent = `${e.target.value} pkts`;
            this.runSimulation();
        });

        this.scenarioSelect.addEventListener('change', () => {
            this.pause();
            this.cancelCurrentAnimation();
            this.forcedLossRtt = null;
            const scenario = this.scenarioSelect.value;
            if (scenario === 'slow_start_exponential') {
                this.ssthreshSlider.value = 28;
                this.ssthreshVal.textContent = '28 MSS';
                this.bufferSlider.value = 28;
                this.bufferVal.textContent = '28 pkts';
            } else if (scenario === 'congestion_avoidance_linear') {
                this.ssthreshSlider.value = 4;
                this.ssthreshVal.textContent = '4 MSS';
                this.bufferSlider.value = 24;
                this.bufferVal.textContent = '24 pkts';
            } else if (scenario === 'buffer_overflow_taildrop') {
                this.ssthreshSlider.value = 12;
                this.ssthreshVal.textContent = '12 MSS';
                this.bufferSlider.value = 10;
                this.bufferVal.textContent = '10 pkts';
            } else if (scenario === 'tahoe_vs_reno') {
                this.ssthreshSlider.value = 16;
                this.ssthreshVal.textContent = '16 MSS';
                this.bufferSlider.value = 20;
                this.bufferVal.textContent = '20 pkts';
                this.renoToggle.checked = true;
                this.showReno = true;
                this.legendReno.classList.remove('hidden');
            } else if (scenario === 'high_bdp_pipe') {
                this.ssthreshSlider.value = 20;
                this.ssthreshVal.textContent = '20 MSS';
                this.bufferSlider.value = 28;
                this.bufferVal.textContent = '28 pkts';
            } else if (scenario === 'textbook_24_11') {
                this.ssthreshSlider.value = 16;
                this.ssthreshVal.textContent = '16 MSS';
                this.bufferSlider.value = 24;
                this.bufferVal.textContent = '24 pkts';
            } else if (scenario === 'fast_retransmit_3ack') {
                this.ssthreshSlider.value = 12;
                this.ssthreshVal.textContent = '12 MSS';
                this.bufferSlider.value = 16;
                this.bufferVal.textContent = '16 pkts';
            } else if (scenario === 'severe_timeout_rto') {
                this.ssthreshSlider.value = 16;
                this.ssthreshVal.textContent = '16 MSS';
                this.bufferSlider.value = 20;
                this.bufferVal.textContent = '20 pkts';
            } else if (scenario === 'random_wireless_loss') {
                this.ssthreshSlider.value = 16;
                this.ssthreshVal.textContent = '16 MSS';
                this.bufferSlider.value = 20;
                this.bufferVal.textContent = '20 pkts';
            }
            this.runSimulation();
        });

        this.renoToggle.addEventListener('change', (e) => {
            this.showReno = e.target.checked;
            this.legendReno.classList.toggle('hidden', !this.showReno);
            this.chartRenderer.setData(this.snapshots, this.currentRtt, this.showReno);
        });

        this.btnAckMiss.addEventListener('click', () => {
            this.pause();
            this.cancelCurrentAnimation();
            this.scenarioSelect.value = 'fast_retransmit_3ack';
            this.ssthreshSlider.value = 12;
            this.ssthreshVal.textContent = '12 MSS';
            this.bufferSlider.value = 16;
            this.bufferVal.textContent = '16 pkts';
            this.runSimulation();
            this.goToRtt(3);
            setTimeout(() => {
                this.animateStep(4);
            }, 180);
        });

        this.btnForceLoss.addEventListener('click', () => {
            this.pause();
            this.cancelCurrentAnimation();
            this.scenarioSelect.value = 'severe_timeout_rto';
            this.ssthreshSlider.value = 16;
            this.ssthreshVal.textContent = '16 MSS';
            this.bufferSlider.value = 20;
            this.bufferVal.textContent = '20 pkts';
            this.runSimulation();
            this.goToRtt(5);
            setTimeout(() => {
                this.animateStep(6);
            }, 180);
        });

        this.btnRunSim.addEventListener('click', () => {
            this.forcedLossRtt = null;
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
            this.cancelCurrentAnimation();
            this.goToRtt(0);
            this.scrollLogToTop(true);
        });

        this.timelineSlider.addEventListener('input', (e) => {
            this.pause();
            this.cancelCurrentAnimation();
            this.goToRtt(parseInt(e.target.value, 10));
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
                const target = btn.dataset.tab;
                this.tabButtons.forEach(b => b.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(target);
                if (pane) pane.classList.add('active');
                this.scrollLogToTop(false);
            });
        });
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
    }

    cancelCurrentAnimation() {
        if (this.animTimer) {
            cancelAnimationFrame(this.animTimer);
            this.animTimer = null;
        }
        this.animTargetRtt = null;
    }

    runSimulation() {
        this.cancelCurrentAnimation();
        const ssthresh = parseInt(this.ssthreshSlider.value, 10);
        const buffer = parseInt(this.bufferSlider.value, 10);
        const scenario = this.scenarioSelect.value;

        this.snapshots = TahoeEngine.generateSimulation(ssthresh, buffer, scenario, this.forcedLossRtt);
        this.timelineSlider.max = Math.max(0, this.snapshots.length - 1);
        this.timelineSlider.disabled = this.snapshots.length <= 1;

        this.buildPhaseRibbon();
        this.goToRtt(0);
        this.scrollLogToTop(true);
    }

    goToRtt(index) {
        if (!this.snapshots || this.snapshots.length === 0) return;
        this.currentRtt = Math.max(0, Math.min(index, this.snapshots.length - 1));

        this.timelineSlider.value = this.currentRtt;
        const curSnap = this.snapshots[this.currentRtt];
        this.currentRoundText.textContent = `Round ${curSnap.rtt} / ${this.snapshots[this.snapshots.length - 1].rtt}`;

        this.updateView();
    }

    updateView(isTransit = false, progress = 1.0) {
        const cur = this.snapshots[this.currentRtt];
        if (!cur) return;

        this.chartRenderer.setData(this.snapshots, this.currentRtt, this.showReno);
        this.pipeRenderer.setState(cur, progress, isTransit);

        this.updateHeaderAndInspector(cur);
        this.updateTimelineUI();
        this.updateMetricsUI(cur.stats);
        this.updateRibbonAndStrips(cur);
    }

    /**
     * Build the phase ribbon dynamically from the snapshot data.
     * Detects phase transitions (ignoring LOSS entries) and creates
     * segments sized proportionally to their RTT span.
     * Called once per scenario load / simulation run.
     */
    buildPhaseRibbon() {
        if (!this.phaseRibbonBar || !this.snapshots || this.snapshots.length === 0) return;

        // Detect phase segments from non-loss snapshots
        const phases = [];
        let currentPhase = null;
        let segStartRtt = 0;

        for (const s of this.snapshots) {
            if (s.isLoss) continue; // loss entries share the RTT of the previous snapshot
            if (s.phase !== currentPhase) {
                if (currentPhase !== null) {
                    phases.push({ phase: currentPhase, startRtt: segStartRtt, endRtt: s.rtt });
                }
                currentPhase = s.phase;
                segStartRtt = s.rtt;
            }
        }
        // Close the last segment at the final RTT
        if (currentPhase !== null) {
            const lastRtt = this.snapshots[this.snapshots.length - 1].rtt;
            phases.push({ phase: currentPhase, startRtt: segStartRtt, endRtt: lastRtt });
        }

        // Store for use in updateRibbonAndStrips
        this._ribbonPhases = phases;

        // Generate HTML with proportional flex values
        this.phaseRibbonBar.innerHTML = phases.map((seg, i) => {
            const span = seg.endRtt - seg.startRtt;
            const cssClass = seg.phase === 'SLOW START' ? 'ribbon-ss' : 'ribbon-ca';
            const label = seg.phase === 'SLOW START' ? 'SS: Slow Start' : 'CA: Congestion Avoidance';
            return `<div class="ribbon-segment ${cssClass}" data-phase-idx="${i}" style="flex: ${span};">${label}</div>`;
        }).join('');
    }

    updateRibbonAndStrips(cur) {
        // Highlight active phase segment based on current RTT
        if (this._ribbonPhases && this.phaseRibbonBar) {
            const segments = this.phaseRibbonBar.querySelectorAll('.ribbon-segment');
            segments.forEach(s => s.classList.remove('active-segment'));

            for (let i = 0; i < this._ribbonPhases.length; i++) {
                const p = this._ribbonPhases[i];
                const isLast = i === this._ribbonPhases.length - 1;
                // For the last segment use <= for the end boundary
                if (cur.rtt >= p.startRtt && (isLast ? cur.rtt <= p.endRtt : cur.rtt < p.endRtt)) {
                    const el = this.phaseRibbonBar.querySelector(`[data-phase-idx="${i}"]`);
                    if (el) el.classList.add('active-segment');
                    break;
                }
            }
        }

        // Render Packet & ACK Track tokens
        if (cur.packetsTrack && cur.packetsTrack.length > 0) {
            this.stripPackets.innerHTML = cur.packetsTrack.map(p => `
                <span class="pkt-token ${p.status === 'lost' ? 'token-lost' : ''}">
                    #${p.seq}${p.status === 'lost' ? ' (LOST)' : ''}
                </span>
            `).join('');
        } else {
            this.stripPackets.innerHTML = `<span class="text-muted" style="font-size:10.5px;">No packets in transit</span>`;
        }

        if (cur.acksTrack && cur.acksTrack.length > 0) {
            this.stripAcks.innerHTML = cur.acksTrack.map(a => `
                <span class="ack-token ${a.isDup ? 'token-dupack' : (a.isMissing ? 'token-missing' : '')}">
                    ${a.ack}
                </span>
            `).join('');
        } else {
            this.stripAcks.innerHTML = `<span class="text-muted" style="font-size:10.5px;">No ACKs</span>`;
        }
    }

    stepForward() {
        if (this.animTimer && this.animTargetRtt !== null) {
            const target = this.animTargetRtt;
            this.cancelCurrentAnimation();
            this.goToRtt(target);
        } else {
            this.cancelCurrentAnimation();
        }
        if (this.currentRtt < this.snapshots.length - 1) {
            this.animateStep(this.currentRtt + 1);
        }
    }

    stepBackward() {
        this.cancelCurrentAnimation();
        if (this.currentRtt > 0) {
            this.goToRtt(this.currentRtt - 1);
        }
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');

        if (this.currentRtt >= this.snapshots.length - 1) {
            this.goToRtt(0);
        }
        this.scheduleNextPlay();
    }

    pause() {
        this.isPlaying = false;
        this.iconPlay.classList.remove('hidden');
        this.iconPause.classList.add('hidden');
        if (this.animTimer && this.animTargetRtt !== null) {
            const target = this.animTargetRtt;
            this.cancelCurrentAnimation();
            this.goToRtt(target);
        } else {
            this.cancelCurrentAnimation();
            this.pipeRenderer.setState(this.snapshots[this.currentRtt], 1.0, false);
        }
    }

    scheduleNextPlay() {
        if (!this.isPlaying) return;
        if (this.currentRtt >= this.snapshots.length - 1) {
            this.pause();
            return;
        }

        const next = this.currentRtt + 1;
        this.animateStep(next, () => {
            if (this.isPlaying) {
                setTimeout(() => {
                    this.scheduleNextPlay();
                }, 100);
            }
        });
    }

    animateStep(targetRtt, onComplete = null) {
        this.cancelCurrentAnimation();
        const nextSnap = this.snapshots[targetRtt];
        if (!nextSnap) return;

        this.animTargetRtt = targetRtt;

        // The speed multiplier controls the flight speed of packets moving across the canvas
        const duration = this.baseDuration / this.speedMultiplier;
        const startTime = performance.now();
        const roundTag = nextSnap.roundLabel || `Round ${nextSnap.rtt}`;

        this.pipeLiveStatus.textContent = `📤 ${roundTag}: Transmitting ${nextSnap.cwnd} packets across channel...`;

        // Update strips with upcoming in-flight packets and expected ACKs
        this.updateRibbonAndStrips(nextSnap);

        const step = (now) => {
            const elapsed = now - startTime;
            const p = Math.min(1.0, elapsed / duration);

            this.pipeRenderer.setState(nextSnap, p, true);

            if (p < 0.25) {
                this.pipeLiveStatus.textContent = `📤 ${roundTag}: Transmitting ${nextSnap.cwnd} data packets across forward link...`;
                if (this.inspLiveAction) {
                    this.inspLiveAction.innerHTML = `<span style="color:#38bdf8">📤 Transmitting ${nextSnap.cwnd} pkts to router</span>`;
                }
            } else if (p < 0.48) {
                if (nextSnap.isLoss) {
                    this.pipeLiveStatus.textContent = nextSnap.lossType === 'timeout'
                        ? `🚨 ${roundTag}: Router buffer overflow! Packet loss occurred...`
                        : `⚠️ ${roundTag}: Packet dropped at router! Sequence gap detected...`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#f43f5e">🚨 Router Buffer Overflow / Drop</span>`;
                    }
                } else {
                    this.pipeLiveStatus.textContent = `🔄 ${roundTag}: Router queued ${nextSnap.routerQueue}/${nextSnap.bufferCapacity} pkts, arriving at receiver...`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#a855f7">🔄 Router Queue: ${nextSnap.routerQueue}/${nextSnap.bufferCapacity} pkts</span>`;
                    }
                }
            } else if (p < 0.98) {
                if (nextSnap.isLoss && nextSnap.lossType === 'timeout') {
                    this.pipeLiveStatus.textContent = `⏱️ ${roundTag}: RTO Timer running... Zero ACKs returning (Timeout)`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#f43f5e">⏱️ Awaiting ACKs: RTO Timer active</span>`;
                    }
                } else if (nextSnap.isLoss) {
                    this.pipeLiveStatus.textContent = `⚡ ${roundTag}: Receiver returning 3 Duplicate ACKs (Fast Retransmit)...`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#f59e0b">⚡ 3 Duplicate ACKs in transit</span>`;
                    }
                } else {
                    this.pipeLiveStatus.textContent = `📨 ${roundTag}: Receiver returning ${nextSnap.cwnd} cumulative ACKs to sender...`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#10b981">📨 Returning ${nextSnap.cwnd} ACKs to sender</span>`;
                    }
                }
            } else {
                if (nextSnap.isLoss) {
                    this.pipeLiveStatus.textContent = `💥 ${roundTag}: Halved ssthresh to ${nextSnap.nextSsthresh} MSS, cwnd resets to ${nextSnap.nextCwnd} MSS`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#f43f5e">💥 Multiplicative Decrease Applied</span>`;
                    }
                } else {
                    this.pipeLiveStatus.textContent = `🎯 ${roundTag}: ACKs arrived! cwnd updated to ${nextSnap.nextCwnd} MSS`;
                    if (this.inspLiveAction) {
                        this.inspLiveAction.innerHTML = `<span style="color:#10b981">🎯 Window updated to ${nextSnap.nextCwnd} MSS</span>`;
                    }
                }
            }

            if (p < 1.0) {
                this.animTimer = requestAnimationFrame(step);
            } else {
                this.animTimer = null;
                this.animTargetRtt = null;
                // PACKETS HAVE REACHED! Show the round logs, inspector, chart, and metrics IMMEDIATELY:
                this.goToRtt(targetRtt);
                this.pipeRenderer.setState(nextSnap, 1.0, false);
                this.pipeLiveStatus.textContent = nextSnap.isLoss
                    ? (nextSnap.lossType === 'timeout'
                        ? `💥 ${roundTag}: Timeout Expired! cwnd reset to ${nextSnap.nextCwnd} MSS, ssthresh = ${nextSnap.nextSsthresh} MSS`
                        : `⚡ ${roundTag}: Fast Retransmit! cwnd reset to ${nextSnap.nextCwnd} MSS, ssthresh = ${nextSnap.nextSsthresh} MSS`)
                    : `✅ ${roundTag} Completed: cwnd = ${nextSnap.cwnd} MSS (Next: ${nextSnap.nextCwnd} MSS)`;
                if (onComplete) onComplete();
            }
        };

        this.animTimer = requestAnimationFrame(step);
    }

    setupContinuousAnimation() {
        const loop = () => {
            if (!this.isPlaying) {
                this.chartRenderer.draw();
                this.pipeRenderer.draw();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateHeaderAndInspector(cur) {
        this.tahoePhaseBadge.className = 'phase-badge';
        if (cur.isLoss) {
            this.tahoePhaseBadge.classList.add('phase-loss');
            this.tahoePhaseText.textContent = cur.lossType === 'timeout' ? 'Time-out (MD: cwnd → 1)' : '3 ACKs (MD: Fast Retransmit)';
            this.growthRateFormula.textContent = 'ssthresh ← ⌊cwnd/2⌋';
        } else if (cur.phase === 'SLOW START') {
            this.tahoePhaseBadge.classList.add('phase-slowstart');
            this.tahoePhaseText.textContent = 'SS: Slow Start (Exponential 2×)';
            this.growthRateFormula.textContent = 'cwnd ← cwnd × 2 (+1 MSS / ACK)';
        } else {
            this.tahoePhaseBadge.classList.add('phase-avoidance');
            this.tahoePhaseText.textContent = 'AI: Additive Increase (+1 MSS)';
            this.growthRateFormula.textContent = 'cwnd ← cwnd + 1 MSS / RTT';
        }

        const dot = this.simStatusBadge.querySelector('.status-dot');
        dot.className = 'status-dot';
        if (this.currentRtt === 0) {
            dot.classList.add('ready');
            this.simStatusText.textContent = 'Ready';
        } else if (this.currentRtt < this.snapshots.length - 1) {
            dot.classList.add('running');
            this.simStatusText.textContent = cur.roundLabel || `Round ${cur.rtt}`;
        } else {
            dot.classList.add('complete');
            this.simStatusText.textContent = 'Complete';
        }

        if (this.inspLiveAction) {
            if (cur.isLoss) {
                this.inspLiveAction.innerHTML = cur.lossType === 'timeout'
                    ? '<span style="color:#f43f5e">🚨 Time-out Drop: MD crushed cwnd to 1</span>'
                    : '<span style="color:#f59e0b">⚡ 3 DupACKs: Fast Retransmit</span>';
            } else if (cur.rtt === 0) {
                this.inspLiveAction.textContent = '💤 Ready / Connection Initialized';
            } else if (cur.phase === 'SLOW START') {
                this.inspLiveAction.innerHTML = `<span style="color:#38bdf8">🚀 Slow Start: Doubling cwnd (+${cur.cwnd} MSS)</span>`;
            } else {
                this.inspLiveAction.innerHTML = `<span style="color:#f59e0b">📈 Additive Increase (+1 MSS/RTT)</span>`;
            }
        }

        this.quickInflight.textContent = cur.cwnd;
        this.quickQueue.textContent = `${cur.routerQueue} / ${cur.bufferCapacity}`;
        this.quickDropBadge.innerHTML = `Loss / DupACKs: <strong>${cur.stats.losses}</strong>`;

        this.inspCwnd.textContent = `${cur.cwnd} MSS`;
        this.inspSsthresh.textContent = `${cur.ssthresh} MSS`;
        this.inspPhase.textContent = cur.phase;
        this.inspFormula.textContent = cur.phase === 'SLOW START' ? 'cwnd ← cwnd × 2' : 'cwnd ← cwnd + 1 MSS';
        this.inspInflight.textContent = `${cur.cwnd} MSS (${cur.cwnd} pkts)`;
        this.inspDupacks.textContent = cur.isLoss && cur.lossType === '3ack' ? '3 (Fast Retransmit)' : '0';

        this.inspBufferOcc.textContent = `${cur.routerQueue} / ${cur.bufferCapacity} pkts`;
        const utilPct = Math.round((cur.routerQueue / cur.bufferCapacity) * 100);
        this.inspBufferUtil.textContent = `${utilPct}%`;
        this.inspDrops.textContent = cur.stats.losses;

        this.inspRcvAck.textContent = `${cur.stats.delivered} pkts`;
        this.inspRcvLastack.textContent = `ACK #${cur.stats.delivered}`;
    }

    updateTimelineUI() {
        this.timelineEventsList.innerHTML = '';
        this.logCountBadge.textContent = this.currentRtt;

        for (let r = 0; r <= this.currentRtt; r++) {
            const snap = this.snapshots[r];
            const isCurrent = r === this.currentRtt;

            const card = document.createElement('div');
            card.className = `timeline-round-card ${isCurrent ? 'current-round-highlight' : ''}`;

            const roundTitle = snap.roundLabel || (snap.isLoss 
                ? `Round ${snap.rtt} (${snap.lossType === 'timeout' ? 'Time-out' : '3-DupACK'})` 
                : (snap.rtt === 0 ? 'Initial Setup' : `Round ${snap.rtt}`));

            const header = document.createElement('div');
            header.className = 'round-card-header';
            header.innerHTML = `
                <span>${roundTitle}: ${snap.phase}</span>
                <span class="round-card-badge">cwnd = ${snap.cwnd} MSS</span>
            `;
            card.appendChild(header);

            const actionList = document.createElement('div');
            actionList.className = 'timeline-action-list';

            snap.events.forEach(evt => {
                const item = document.createElement('div');
                item.className = `timeline-action-item action-${evt.type}`;

                let icon = 'ℹ️';
                if (evt.type === 'slowstart') icon = '🚀';
                else if (evt.type === 'avoidance') icon = '📈';
                else if (evt.type === 'loss') icon = '🚨';
                else if (evt.type === 'transmit') icon = '📤';
                else if (evt.type === 'router') icon = '🔄';
                else if (evt.type === 'receiver') icon = '📥';

                item.innerHTML = `
                    <span class="action-icon">${icon}</span>
                    <span class="action-text">${evt.text}</span>
                `;
                actionList.appendChild(item);
            });

            card.appendChild(actionList);
            this.timelineEventsList.appendChild(card);
        }

        if (this.currentRtt === 0) {
            this.scrollLogToTop(false);
        } else {
            const currentCard = this.timelineEventsList.querySelector('.current-round-highlight');
            if (currentCard) {
                currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    updateMetricsUI(stats) {
        if (!stats) return;

        this.metricPeakCwnd.textContent = `${stats.peakCwnd} MSS`;
        this.metricDelivered.textContent = stats.delivered;
        this.metricLosses.textContent = stats.losses;
        this.metricCurSsthresh.textContent = `${stats.curSsthresh} MSS`;
        this.metricThroughput.textContent = stats.avgThroughput;
        this.metricGoodput.textContent = `${stats.goodput}%`;

        if (stats.lossHistory && stats.lossHistory.length > 0) {
            this.lossHistoryList.innerHTML = stats.lossHistory.map(l => `
                <div class="loss-chip">
                    <span>Round ${l.rtt}: cwnd ${l.droppedCwnd} → ${l.newSsthresh}</span>
                    <span style="font-size:10.5px; color:#c084fc;">${l.reason}</span>
                </div>
            `).join('');
        } else {
            this.lossHistoryList.innerHTML = `<p class="text-muted">No loss events yet.</p>`;
        }
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new TahoeSimulationController();
});
