<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
            {{ __('WebRTC Call Room') }}
        </h2>
    </x-slot>

    @push('scripts')
    <script>
        window.__AUTH_ID__   = {{ auth()->id() }};
        window.__AUTH_NAME__ = @json(auth()->user()->name);
    </script>
    @endpush

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                <div x-data="callApp" class="space-y-4">
                    <!-- Room Input -->
                    <div class="flex gap-2">
                        <input x-model="roomId" type="text" placeholder="Masukkan Room ID"
                               class="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <button @click="joinRoom" :disabled="isInRoom"
                                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                            Join Room
                        </button>
                    </div>

                    <!-- Call Controls -->
                    <div x-show="isInRoom" class="flex gap-2">
                        <button @click="startCall" :disabled="isCalling || isConnected"
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                            Start Call
                        </button>
                        <button @click="endCall" :disabled="!isConnected && !isCalling"
                                class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                            End Call
                        </button>
                    </div>

                    <!-- Media Controls (Mute/Unmute) -->
                    <div x-show="isConnected || isCalling" class="flex gap-2">
                        <!-- Microphone Toggle -->
                        <button @click="toggleMic"
                                :class="micMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'"
                                class="px-3 py-1 text-white rounded text-sm transition"
                                title="Mute/Unmute Microphone">
                            <span x-text="micMuted ? '🔇 Unmute' : '🎤 Mute'"></span>
                        </button>

                        <!-- Camera Toggle -->
                        <button @click="toggleCamera"
                                :class="cameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'"
                                class="px-3 py-1 text-white rounded text-sm transition"
                                title="Turn Camera On/Off">
                            <span x-text="cameraOff ? '📵 Camera On' : '📹 Camera Off'"></span>
                        </button>
                    </div>

                    <!-- Status -->
                    <p x-text="status" class="text-sm text-gray-500 dark:text-gray-400 h-5"></p>

                    <!-- Video Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div class="bg-gray-900 rounded-lg p-2 relative">
                            <video x-ref="localVideo" autoplay muted playsinline class="w-full rounded bg-black"></video>
                            <span class="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">You</span>
                            <div x-show="micMuted || cameraOff" class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg pointer-events-none">
                                <span class="text-white text-sm font-medium px-3 py-1 bg-black/50 rounded-full">
                                    <span x-show="micMuted && !cameraOff">🔇</span>
                                    <span x-show="cameraOff && !micMuted">📵</span>
                                    <span x-show="micMuted && cameraOff">🔇 & 📵</span>
                                </span>
                            </div>
                        </div>
                        <div class="bg-gray-900 rounded-lg p-2 relative">
                            <video x-ref="remoteVideo" autoplay playsinline class="w-full rounded bg-black"></video>
                            <span class="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">Remote</span>
                            <template x-for="user in remoteUsers" :key="user.id">
                                <div x-show="remoteUsers.length > 0" class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg pointer-events-none text-white">
                                    <span x-show="user.micMuted && !user.cameraOff" class="text-sm bg-black/50 px-1.5 py-0.5 rounded">🔇</span>
                                    <span x-show="user.cameraOff && !user.micMuted" class="text-sm bg-black/50 px-1.5 py-0.5 rounded">📵</span>
                                    <span x-show="user.micMuted && user.cameraOff" class="text-sm bg-black/50 px-1.5 py-0.5 rounded">🔇 & 📵</span></span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
