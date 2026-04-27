import { Alpine } from './echo';

export function initChatApp() {
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
                this.channel = Echo.join('chat-channel')
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
            Echo.join('chat-channel').whisper('typing', {
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
}
