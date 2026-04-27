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
        <div class="max-w-6xl mx-auto sm:px-6 lg:px-8 space-y-4">
            <div x-data="callApp" class="space-y-4">

                {{-- Room Input --}}
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex gap-2">
                    <input x-model="roomId" type="text" placeholder="Masukkan Room ID"
                           :disabled="isInRoom"
                           class="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                    <button @click="joinRoom" :disabled="isInRoom"
                            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                        Join Room
                    </button>
                </div>

                {{-- Room Users List --}}
                <div x-show="isInRoom" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                    <p class="text-xs text-gray-400 mb-2">Users di room:</p>
                    <div class="flex flex-wrap gap-2">
                        <template x-for="user in roomUsers" :key="user.id">
                            <span class="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                                  :class="user.id === {{ auth()->id() }}
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-200'">
                                <span class="w-2 h-2 rounded-full"
                                      :class="user.inCall ? 'bg-green-400' : 'bg-yellow-400'"></span>
                                <span x-text="user.id === {{ auth()->id() }} ? user.name + ' (You)' : user.name"></span>
                                <span x-show="user.inCall"
                                      class="text-xs opacity-75">· in call</span>
                            </span>
                        </template>
                    </div>
                </div>

                {{-- Controls --}}
                <div x-show="isInRoom" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-wrap gap-2">
                    <button @click="startCall" :disabled="isCalling || localStream"
                            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                        Start Call
                    </button>
                    <button @click="endCall" :disabled="!localStream"
                            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                        End Call
                    </button>
                    <template x-if="localStream">
                        <div class="flex gap-2">
                            <button @click="toggleMic"
                                    :class="micMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'"
                                    class="px-3 py-2 text-white rounded text-sm transition">
                                <span x-text="micMuted ? '🔇 Unmute' : '🎤 Mute'"></span>
                            </button>
                            <button @click="toggleCamera"
                                    :class="cameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'"
                                    class="px-3 py-2 text-white rounded text-sm transition">
                                <span x-text="cameraOff ? '📵 Cam On' : '📹 Cam Off'"></span>
                            </button>
                        </div>
                    </template>
                    <p x-text="status" class="text-sm text-gray-500 dark:text-gray-400 self-center ml-auto"></p>
                </div>

                {{-- Video Grid --}}
                <div x-show="localStream"
                     class="grid gap-4"
                     :class="{
                        'grid-cols-1': remoteUsers.length === 0,
                        'grid-cols-2': remoteUsers.length >= 1 && remoteUsers.length <= 3,
                        'grid-cols-3': remoteUsers.length >= 4
                     }">

                    {{-- Local Video --}}
                    <div class="bg-gray-900 rounded-lg p-2 relative">
                        <video x-ref="localVideo" autoplay muted playsinline class="w-full rounded bg-black aspect-video object-cover"></video>
                        <div class="absolute bottom-2 left-2 flex items-center gap-1">
                            <span class="text-xs text-white bg-black/60 px-2 py-0.5 rounded">
                                {{ auth()->user()->name }} (You)
                            </span>
                            <span x-show="micMuted" class="text-xs bg-red-600 px-1.5 py-0.5 rounded text-white">🔇</span>
                            <span x-show="cameraOff" class="text-xs bg-red-600 px-1.5 py-0.5 rounded text-white">📵</span>
                        </div>
                    </div>

                    {{-- Remote Videos --}}
                    <template x-for="user in remoteUsers" :key="user.id">
                        <div class="bg-gray-900 rounded-lg p-2 relative">
                            <video :id="`remote-video-${user.id}`"
                                   autoplay playsinline
                                   class="w-full rounded bg-black aspect-video object-cover"></video>
                            <div class="absolute bottom-2 left-2 flex items-center gap-1">
                                <span class="text-xs text-white bg-black/60 px-2 py-0.5 rounded" x-text="user.name"></span>
                                <span x-show="user.micMuted" class="text-xs bg-red-600 px-1.5 py-0.5 rounded text-white">🔇</span>
                                <span x-show="user.cameraOff" class="text-xs bg-red-600 px-1.5 py-0.5 rounded text-white">📵</span>
                            </div>
                        </div>
                    </template>
                </div>

            </div>
        </div>
    </div>
</x-app-layout>
