import { Alpine } from './echo';

export function initCallApp() {
    Alpine.data('callApp', () => ({
        roomId: '',
        isInRoom: false,
        isCalling: false,
        isConnected: false,
        status: 'Masukkan Room ID untuk bergabung',
        peer: null,
        channel: null,
        localStream: null,
        pendingCandidates: [],
        peerReady: false,
        micMuted: false,
        cameraOff: false,
        remoteUsers: [],

        toggleMic() {
            if (!this.localStream) return;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.micMuted = !audioTrack.enabled;
                this.sendMediaState();
            }
        },

        toggleCamera() {
            if (!this.localStream) return;
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.cameraOff = !videoTrack.enabled;
                this.sendMediaState();
            }
        },

        sendMediaState() {
            if (!this.channel) return;
            this.channel.whisper('media-state', {
                from: window.__AUTH_ID__,
                micMuted: this.micMuted,
                cameraOff: this.cameraOff
            });
        },

        async joinRoom() {
            if (!this.roomId.trim()) return;
            this.isInRoom = true;
            this.status = `Bergabung ke room: ${this.roomId}...`;

            this.channel = Echo.join(`call.room.${this.roomId}`)
                .here((users) => {
                    this.remoteUsers = users
                        .filter(u => u.id !== window.__AUTH_ID__)
                        .map(u => ({ id: u.id, name: u.name, micMuted: false, cameraOff: false }));
                    const others = this.remoteUsers.length;
                    this.status = others
                        ? `${others} user di room. Klik Start Call untuk memulai.`
                        : 'Kamu sendirian di room. Tunggu user lain join.';
                })
                .joining((user) => {
                    if (!this.remoteUsers.find(u => u.id === user.id)) {
                        this.remoteUsers.push({ id: user.id, name: user.name, micMuted: false, cameraOff: false });
                    }
                    this.status = `${user.name} bergabung.`;
                    if (this.localStream && !this.isConnected) {
                        setTimeout(() => this.initiateOffer(), 1000);
                    }
                })
                .leaving((user) => {
                    this.remoteUsers = this.remoteUsers.filter(u => u.id !== user.id);
                    this.status = `${user.name} meninggalkan room.`;
                    if (this.isConnected || this.isCalling) this.endCall();
                })
                .listenForWhisper('signal', (data) => this.handleSignal(data))
                .listenForWhisper('media-state', (data) => {
                    if (data.from === window.__AUTH_ID__) return;
                    const idx = this.remoteUsers.findIndex(u => u.id === data.from);
                    if (idx !== -1) {
                        this.remoteUsers[idx] = { ...this.remoteUsers[idx], ...data };
                    } else {
                        this.remoteUsers.push({
                            id: data.from,
                            name: 'User',
                            micMuted: data.micMuted,
                            cameraOff: data.cameraOff
                        });
                    }
                });
        },

        async startCall() {
            this.isCalling = true;
            this.status = 'Meminta akses kamera & mikrofon...';
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                this.$refs.localVideo.srcObject = this.localStream;

                if (this.peerReady) {
                    await this.initiateOffer();
                } else {
                    this.status = 'Stream aktif. Menunggu user lain...';
                    this.channel.whisper('signal', { type: 'ready', from: window.__AUTH_ID__ });
                }
            } catch (err) {
                this.status = 'Gagal akses media: ' + err.message;
                this.isCalling = false;
            }
        },

        async initiateOffer() {
            this.initPeer();
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            this.sendSignal({ type: 'offer', sdp: offer });
            this.status = 'Menawarkan panggilan...';
        },

        initPeer() {
            if (this.peer) this.peer.close();
            this.pendingCandidates = [];

            this.peer = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            });

            this.localStream.getTracks().forEach(track => this.peer.addTrack(track, this.localStream));

            this.peer.ontrack = (e) => {
                if (this.$refs?.remoteVideo) {
                    this.$refs.remoteVideo.srcObject = e.streams[0];
                } else {
                    this.$nextTick(() => {
                        if (this.$refs?.remoteVideo) {
                            this.$refs.remoteVideo.srcObject = e.streams[0];
                        }
                    });
                }
            };

            this.peer.onicecandidate = (e) => {
                if (e.candidate) {
                    this.sendSignal({ type: 'ice', candidate: e.candidate });
                }
            };

            this.peer.onconnectionstatechange = () => {
                const state = this.peer?.connectionState;
                if (state === 'connected') {
                    this.isConnected = true;
                    this.isCalling = false;
                    this.status = '🟢 Terhubung! Panggilan aktif.';
                } else if (state === 'disconnected') {
                    this.status = '⏳ Terputus. Mencoba menyambung kembali...';
                } else if (state === 'failed' || state === 'closed') {
                    this.status = '🔴 Koneksi gagal atau ditutup.';
                    this.endCall();
                }
            };

            this.peer.oniceconnectionstatechange = () => {
                if (this.peer?.iceConnectionState === 'failed') {
                    this.peer.restartIce();
                    this.status = '🔄 Jaringan tidak stabil, mencoba reconnect...';
                }
            };
        },

        async handleSignal(data) {
            if (data.from !== undefined && data.from === window.__AUTH_ID__) return;

            switch (data.type) {
                case 'ready':
                    if (this.localStream && !this.isConnected && !this.isCalling) {
                        const myId = window.__AUTH_ID__;
                        const theirId = data.from;
                        if (myId < theirId) {
                            this.isCalling = true;
                            await this.initiateOffer();
                        } else {
                            this.peerReady = true;
                            this.status = 'Menunggu panggilan masuk...';
                        }
                    } else if (!this.localStream) {
                        this.peerReady = true;
                    }
                    break;

                case 'offer':
                    this.status = '📞 Panggilan masuk...';
                    if (!this.localStream) {
                        try {
                            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                            this.$refs.localVideo.srcObject = this.localStream;
                        } catch (err) {
                            this.status = 'Gagal akses media: ' + err.message;
                            return;
                        }
                    }
                    this.initPeer();
                    await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    for (const c of this.pendingCandidates) {
                        await this.peer.addIceCandidate(new RTCIceCandidate(c));
                    }
                    this.pendingCandidates = [];
                    const answer = await this.peer.createAnswer();
                    await this.peer.setLocalDescription(answer);
                    this.sendSignal({ type: 'answer', sdp: answer });
                    this.status = 'Menjawab panggilan...';
                    break;

                case 'answer':
                    await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    for (const c of this.pendingCandidates) {
                        await this.peer.addIceCandidate(new RTCIceCandidate(c));
                    }
                    this.pendingCandidates = [];
                    this.status = 'Menunggu koneksi media...';
                    break;

                case 'ice':
                    if (!this.peer || !this.peer.remoteDescription) {
                        this.pendingCandidates.push(data.candidate);
                    } else {
                        await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                    break;
            }
        },

        sendSignal(payload) {
            if (!this.channel) return;
            this.channel.whisper('signal', { ...payload, from: window.__AUTH_ID__ });
        },

        endCall() {
            if (this.peer) { this.peer.close(); this.peer = null; }
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            if (this.$refs.localVideo) this.$refs.localVideo.srcObject = null;
            if (this.$refs.remoteVideo) this.$refs.remoteVideo.srcObject = null;

            this.isConnected = false;
            this.isCalling = false;
            this.peerReady = false;
            this.pendingCandidates = [];
            this.remoteUsers = [];
            this.micMuted = false;
            this.cameraOff = false;
            this.status = 'Panggilan berakhir.';
        }
    }));
}
