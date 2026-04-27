import './echo';

import Alpine from 'alpinejs';

window.Alpine = Alpine;

document.addEventListener('alpine:init', () => {
    Alpine.data('chatApp', () => ({
        messages: window.__CHAT_MESSAGES__ ?? [],
        newMessage: '',
        loading: false,
        typingUsers: [],
        typingTimer: null,
        channel: null,

        init() {
            this.$nextTick(() => this.scrollToBottom());

            if (window.Echo) {
                this.channel = window.Echo.join('chat-channel')
                    .here((users) => {})
                    .listen('.MessageSent', (e) => {
                        const existsReal = this.messages.some(m => m.id === e.id);
                        if (existsReal) return;

                        const tempIdx = this.messages.findIndex(
                            m => String(m.id).startsWith('temp_') && m.user_id === e.user_id
                        );
                        if (tempIdx !== -1) {
                            this.messages.splice(tempIdx, 1, {
                                id: e.id,
                                user_id: e.user_id,
                                user_name: e.user_name ?? 'User',
                                message: e.message,
                                created_at: e.created_at
                            });
                        } else {
                            this.messages.push({
                                id: e.id,
                                user_id: e.user_id,
                                user_name: e.user_name ?? 'User',
                                message: e.message,
                                created_at: e.created_at
                            });
                            this.$nextTick(() => this.scrollToBottom());
                        }
                    })
                    .listenForWhisper('typing', (e) => {
                        if (!this.typingUsers.find(u => u.id === e.id)) {
                            this.typingUsers.push(e);
                        }
                        clearTimeout(this[`typingTimer_${e.id}`]);
                        this[`typingTimer_${e.id}`] = setTimeout(() => {
                            this.typingUsers = this.typingUsers.filter(u => u.id !== e.id);
                        }, 2000);
                    });
            }
        },

        onTyping() {
            if (!this.channel) return;
            this.channel.whisper('typing', {
                id: window.__AUTH_ID__,
                name: window.__AUTH_NAME__,
            });
        },

        async sendMessage() {
            if (!this.newMessage.trim() || this.loading) return;

            this.typingUsers = this.typingUsers.filter(u => u.id !== window.__AUTH_ID__);

            const tempId = 'temp_' + Date.now();
            this.messages.push({
                id: tempId,
                user_id: window.__AUTH_ID__,
                user_name: window.__AUTH_NAME__,
                message: this.newMessage,
                created_at: 'Just now'
            });

            const payload = this.newMessage;
            this.newMessage = '';
            this.loading = true;
            this.$nextTick(() => this.scrollToBottom());

            try {
                const res = await fetch(window.__CHAT_STORE_URL__, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': window.__CSRF_TOKEN__,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ message: payload })
                });

                if (!res.ok) throw new Error('Network error');
            } catch (err) {
                console.error('Gagal kirim:', err);
                this.messages = this.messages.filter(m => m.id !== tempId);
            } finally {
                this.loading = false;
            }
        },

        scrollToBottom() {
            const el = this.$refs.messageContainer;
            if (el) el.scrollTop = el.scrollHeight;
        }
    }));

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

            this.channel = window.Echo.join(`call.room.${this.roomId}`)
                .here((users) => {
                    console.log('[CALL] here - users:', users);
                    this.remoteUsers = users
                        .filter(u => u.id !== window.__AUTH_ID__)
                        .map(u => ({ id: u.id, name: u.name, micMuted: false, cameraOff: false }));

                    const others = this.remoteUsers.length;
                    this.status = others
                        ? `${others} user di room. Klik Start Call untuk memulai.`
                        : 'Kamu sendirian di room. Tunggu user lain join.';
                })
                .joining((user) => {
                    console.log('[CALL] joining:', user);
                    if (!this.remoteUsers.find(u => u.id === user.id)) {
                        this.remoteUsers.push({ id: user.id, name: user.name, micMuted: false, cameraOff: false });
                    }
                    this.status = `${user.name} bergabung.`;
                    if (this.localStream && !this.isConnected) {
                        setTimeout(() => this.initiateOffer(), 1000);
                    }
                })
                .leaving((user) => {
                    console.log('[CALL] leaving:', user);
                    this.remoteUsers = this.remoteUsers.filter(u => u.id !== user.id);
                    this.status = `${user.name} meninggalkan room.`;
                    if (this.isConnected || this.isCalling) this.endCall();
                })
                .listenForWhisper('signal', (data) => {
                    console.log('[CALL] whisper in:', data.type, data);
                    this.handleSignal(data);
                })
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
                    console.log('[CALL] Remote user media state updated:', data);
                });
        },

        async startCall() {
            this.isCalling = true;
            this.status = 'Meminta akses kamera & mikrofon...';
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                this.$refs.localVideo.srcObject = this.localStream;
                console.log('[CALL] startCall - stream ready, peerReady:', this.peerReady);

                if (this.peerReady) {
                    // Lawan sudah whisper ready duluan — kita yang offer
                    console.log('[CALL] peerReady flag aktif, langsung initiateOffer');
                    await this.initiateOffer();
                } else {
                    // Lawan belum ready — whisper ready, tunggu mereka balas dengan offer atau ready
                    this.status = 'Stream aktif. Menunggu user lain...';
                    this.channel.whisper('signal', { type: 'ready', from: window.__AUTH_ID__ });
                }
            } catch (err) {
                this.status = 'Gagal akses media: ' + err.message;
                this.isCalling = false;
            }
        },

        async initiateOffer() {
            console.log('[CALL] initiateOffer - creating offer...');
            this.initPeer();
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            console.log('[CALL] initiateOffer - offer created, whisper offer');
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
                console.log('[CALL] ontrack - remote stream received');
                this.$refs.remoteVideo.srcObject = e.streams[0];
            };

            this.peer.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log('[CALL] onicecandidate - sending ICE');
                    this.sendSignal({ type: 'ice', candidate: e.candidate });
                }
            };

            this.peer.onconnectionstatechange = () => {
                const state = this.peer?.connectionState;
                console.log('[CALL] connectionState:', state);
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

            this.peer.onsignalingstatechange = () => {
                console.log('[CALL] signalingState:', this.peer?.signalingState);
            };

            this.peer.onicegatheringstatechange = () => {
                console.log('[CALL] iceGatheringState:', this.peer?.iceGatheringState);
            };

            this.peer.oniceconnectionstatechange = () => {
                console.log('[CALL] iceConnectionState:', this.peer?.iceConnectionState);
            };
        },

        async handleSignal(data) {
            // Abaikan signal dari diri sendiri, tapi hanya kalau from jelas terdefinisi
            if (data.from !== undefined && data.from === window.__AUTH_ID__) {
                console.log('[CALL] handleSignal: ignored own signal', data.type);
                return;
            }

            console.log('[CALL] handleSignal:', data.type, '| from:', data.from, '| myId:', window.__AUTH_ID__);

            switch (data.type) {
                case 'ready':
                    console.log('[CALL] ready received - localStream:', !!this.localStream, 'isConnected:', this.isConnected, 'isCalling:', this.isCalling);
                    if (this.localStream && !this.isConnected && !this.isCalling) {
                        // Kita sudah punya stream dan belum dalam proses call — kita yang offer
                        console.log('[CALL] kita punya stream, jadi caller, initiateOffer...');
                        this.isCalling = true;
                        await this.initiateOffer();
                    } else if (!this.localStream) {
                        // Kita belum punya stream, simpan flag bahwa lawan sudah ready
                        console.log('[CALL] belum punya stream, set peerReady flag');
                        this.peerReady = true;
                        this.peerReadyFrom = data.from;
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
                    console.log('[CALL] offer handled - whisper answer');
                    this.sendSignal({ type: 'answer', sdp: answer });
                    this.status = 'Menjawab panggilan...';
                    break;

                case 'answer':
                    console.log('[CALL] answer received - signalingState:', this.peer?.signalingState);
                    await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    for (const c of this.pendingCandidates) {
                        await this.peer.addIceCandidate(new RTCIceCandidate(c));
                    }
                    this.pendingCandidates = [];
                    this.status = 'Menunggu koneksi media...';
                    break;

                case 'ice':
                    if (!this.peer || !this.peer.remoteDescription) {
                        console.log('[CALL] ICE queued - no remoteDescription yet');
                        this.pendingCandidates.push(data.candidate);
                    } else {
                        await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                    break;
            }
        },

        sendSignal(payload) {
            if (!this.channel) return;
            console.log('[CALL] whisper out:', payload.type);
            this.channel.whisper('signal', { ...payload, from: window.__AUTH_ID__ });
        },

        endCall() {
            if (this.peer) { this.peer.close(); this.peer = null; }
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            this.$refs.localVideo.srcObject = null;
            this.$refs.remoteVideo.srcObject = null;
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
});

Alpine.start();
