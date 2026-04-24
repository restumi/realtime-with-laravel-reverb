import './echo';

import Alpine from 'alpinejs';

window.Alpine = Alpine;

document.addEventListener('alpine:init', () => {
    Alpine.data('chatApp', () => ({
        messages: window.__CHAT_MESSAGES__ ?? [],
        newMessage: '',
        loading: false,

        init() {
            this.$nextTick(() => this.scrollToBottom());

            if (window.Echo) {
                window.Echo.channel('chat-channel').listen('.MessageSent', (e) => {
                    const exists = this.messages.some(m => m.id === e.id);
                    if (!exists) {
                        this.messages.push({
                            id: e.id,
                            user_id: e.user_id,
                            user_name: e.user_name ?? 'User',
                            message: e.message,
                            created_at: e.created_at
                        });
                        this.$nextTick(() => this.scrollToBottom());
                    }
                });
            }
        },

        async sendMessage() {
            if (!this.newMessage.trim() || this.loading) return;

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
                const data = await res.json();

                const idx = this.messages.findIndex(m => m.id === tempId);
                if (idx !== -1) this.messages[idx] = data;
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
});

Alpine.start();
