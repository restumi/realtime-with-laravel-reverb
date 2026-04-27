import Alpine from 'alpinejs';

export function initCallApp() {
    Alpine.data('callApp', () => ({
        roomId: '',
        isInRoom: false,
        inCall: false,
        isCalling: false,
        status: 'Masukkan Room ID untuk bergabung',

        peers: {},
        pendingCandidates: {},

        channel: null,
        localStream: null,
        micMuted: false,
        cameraOff: false,

        remoteUsers: [],
        roomUsers: [],

        // ─── Room ────────────────────────────────────────────────────────────

        async joinRoom() {
            if (!this.roomId.trim()) return;
            this.isInRoom = true;
            this.status = `Bergabung ke room: ${this.roomId}...`;

            this.channel = window.Echo.join(`call.room.${this.roomId}`)
                .here((users) => {
                    this.roomUsers = users.map(u => ({ id: u.id, name: u.name, inCall: false }));
                    const others = users.filter(u => u.id !== window.__AUTH_ID__);
                    this.status = others.length
                        ? `${others.length} user di room. Klik Start Call untuk bergabung ke call.`
                        : 'Kamu sendirian di room. Tunggu user lain join.';
                })
                .joining((user) => {
                    if (!this.roomUsers.find(u => u.id === user.id)) {
                        this.roomUsers.push({ id: user.id, name: user.name, inCall: false });
                    }
                    this.status = `${user.name} bergabung ke room.`;
                })
                .leaving((user) => {
                    this.roomUsers = this.roomUsers.filter(u => u.id !== user.id);
                    this.status = `${user.name} meninggalkan room.`;
                    this.removePeer(user.id);
                })
                .listenForWhisper('joined-call', (data) => {
                    if (data.from === window.__AUTH_ID__) return;
                    const idx = this.roomUsers.findIndex(u => u.id === data.from);
                    if (idx !== -1) this.roomUsers[idx].inCall = true;
                    if (this.inCall && !this.peers[data.from]) {
                        this.createOffer(data.from);
                    }
                })
                .listenForWhisper('left-call', (data) => {
                    if (data.from === window.__AUTH_ID__) return;
                    const idx = this.roomUsers.findIndex(u => u.id === data.from);
                    if (idx !== -1) this.roomUsers[idx].inCall = false;
                    this.removePeer(data.from);
                })
                .listenForWhisper('signal', (data) => this.handleSignal(data))
                .listenForWhisper('media-state', (data) => {
                    if (data.from === window.__AUTH_ID__) return;
                    const idx = this.remoteUsers.findIndex(u => u.id === data.from);
                    if (idx !== -1) {
                        this.remoteUsers[idx].micMuted = data.micMuted;
                        this.remoteUsers[idx].cameraOff = data.cameraOff;
                    }
                });
        },

        // ─── Call ────────────────────────────────────────────────────────────

        async startCall() {
            this.isCalling = true;
            this.status = 'Meminta akses kamera & mikrofon...';
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                this.$refs.localVideo.srcObject = this.localStream;
                this.inCall = true;

                const myIdx = this.roomUsers.findIndex(u => u.id === window.__AUTH_ID__);
                if (myIdx !== -1) this.roomUsers[myIdx].inCall = true;

                this.channel.whisper('joined-call', { from: window.__AUTH_ID__ });

                const callUsers = this.roomUsers.filter(u => u.id !== window.__AUTH_ID__ && u.inCall);
                if (callUsers.length === 0) {
                    this.isCalling = false;
                    this.status = '🟢 Kamu di call. Menunggu user lain bergabung...';
                } else {
                    for (const user of callUsers) {
                        await this.createOffer(user.id);
                    }
                }
            } catch (err) {
                this.status = 'Gagal akses media: ' + err.message;
                this.isCalling = false;
                this.inCall = false;
            }
        },

        endCall() {
            if (this.channel) {
                this.channel.whisper('left-call', { from: window.__AUTH_ID__ });
            }

            Object.keys(this.peers).forEach(id => this.peers[id].close());
            this.peers = {};
            this.pendingCandidates = {};

            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            if (this.$refs.localVideo) this.$refs.localVideo.srcObject = null;

            const myIdx = this.roomUsers.findIndex(u => u.id === window.__AUTH_ID__);
            if (myIdx !== -1) this.roomUsers[myIdx].inCall = false;

            this.remoteUsers = [];
            this.inCall = false;
            this.isCalling = false;
            this.micMuted = false;
            this.cameraOff = false;
            this.status = 'Panggilan berakhir. Klik Start Call untuk bergabung lagi.';
        },

        // ─── Peer per user ───────────────────────────────────────────────────

        initPeer(userId) {
            if (this.peers[userId]) this.peers[userId].close();
            this.pendingCandidates[userId] = [];

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            });

            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

            pc.ontrack = (e) => {
                const stream = e.streams[0];
                const user = this.roomUsers.find(u => u.id === userId);
                const existing = this.remoteUsers.findIndex(u => u.id === userId);
                if (existing !== -1) {
                    this.remoteUsers[existing].stream = stream;
                } else {
                    this.remoteUsers.push({
                        id: userId,
                        name: user?.name ?? `User ${userId}`,
                        stream,
                        micMuted: false,
                        cameraOff: false,
                    });
                }
                this.$nextTick(() => {
                    const el = document.getElementById(`remote-video-${userId}`);
                    if (el) el.srcObject = stream;
                });
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) this.sendSignal({ type: 'ice', to: userId, candidate: e.candidate });
            };

            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                if (state === 'connected') {
                    this.isCalling = false;
                    this.status = '🟢 Terhubung!';
                } else if (state === 'failed') {
                    pc.restartIce();
                } else if (state === 'closed') {
                    this.removePeer(userId);
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed') pc.restartIce();
            };

            pc.onicecandidateerror = (e) => {
                console.error('[ ERROR ]', e);
            };

            this.peers[userId] = pc;
            return pc;
        },

        async createOffer(userId) {
            const pc = this.initPeer(userId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.sendSignal({ type: 'offer', to: userId, sdp: offer });
            this.status = 'Menghubungkan...';
        },

        removePeer(userId) {
            if (this.peers[userId]) {
                this.peers[userId].close();
                delete this.peers[userId];
            }
            delete this.pendingCandidates[userId];
            this.remoteUsers = this.remoteUsers.filter(u => u.id !== userId);
            if (this.inCall && Object.keys(this.peers).length === 0) {
                this.status = '🟢 Kamu di call. Menunggu user lain bergabung...';
            }
        },

        // ─── Signaling ───────────────────────────────────────────────────────

        async handleSignal(data) {
            if (data.to !== undefined && data.to !== window.__AUTH_ID__) return;
            if (data.from === window.__AUTH_ID__) return;

            if (!this.inCall && data.type === 'offer') {
            }

            const fromId = data.from;

            switch (data.type) {
                case 'offer': {
                    if (!this.inCall) return;

                    if (!this.localStream) return;

                    const pc = this.initPeer(fromId);
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    for (const c of (this.pendingCandidates[fromId] ?? [])) {
                        await pc.addIceCandidate(new RTCIceCandidate(c));
                    }
                    this.pendingCandidates[fromId] = [];
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    this.sendSignal({ type: 'answer', to: fromId, sdp: answer });
                    this.status = 'Menghubungkan...';
                    break;
                }

                case 'answer': {
                    const pc = this.peers[fromId];
                    if (!pc) return;
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    for (const c of (this.pendingCandidates[fromId] ?? [])) {
                        await pc.addIceCandidate(new RTCIceCandidate(c));
                    }
                    this.pendingCandidates[fromId] = [];
                    break;
                }

                case 'ice': {
                    const pc = this.peers[fromId];
                    if (!pc || !pc.remoteDescription) {
                        if (!this.pendingCandidates[fromId]) this.pendingCandidates[fromId] = [];
                        this.pendingCandidates[fromId].push(data.candidate);
                    } else {
                        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                    break;
                }
            }
        },

        sendSignal(payload) {
            if (!this.channel) return;
            this.channel.whisper('signal', { ...payload, from: window.__AUTH_ID__ });
        },

        // ─── Media controls ──────────────────────────────────────────────────

        toggleMic() {
            if (!this.localStream) return;
            const track = this.localStream.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                this.micMuted = !track.enabled;
                this.channel.whisper('media-state', { from: window.__AUTH_ID__, micMuted: this.micMuted, cameraOff: this.cameraOff });
            }
        },

        toggleCamera() {
            if (!this.localStream) return;
            const track = this.localStream.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                this.cameraOff = !track.enabled;
                this.channel.whisper('media-state', { from: window.__AUTH_ID__, micMuted: this.micMuted, cameraOff: this.cameraOff });
            }
        },
    }));
}
