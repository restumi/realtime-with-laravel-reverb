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

                    <!-- Status -->
                    <p x-text="status" class="text-sm text-gray-500 dark:text-gray-400 h-5"></p>

                    <!-- Video Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div class="bg-gray-900 rounded-lg p-2 relative">
                            <video x-ref="localVideo" autoplay muted playsinline class="w-full rounded bg-black"></video>
                            <span class="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">You</span>
                        </div>
                        <div class="bg-gray-900 rounded-lg p-2 relative">
                            <video x-ref="remoteVideo" autoplay playsinline class="w-full rounded bg-black"></video>
                            <span class="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">Remote</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
