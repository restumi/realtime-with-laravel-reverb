<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
            {{ __('Public Chat') }}
        </h2>
    </x-slot>

    @push('scripts')
    <script>
        window.__CHAT_MESSAGES__ = @json($messages);
        window.__AUTH_ID__ = {{ auth()->id() }};
        window.__AUTH_NAME__ = @json(auth()->user()->name);
        window.__CSRF_TOKEN__ = '{{ csrf_token() }}';
        window.__CHAT_STORE_URL__ = '{{ route('chat.store') }}';
    </script>
    @endpush

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                <div class="text-gray-900 dark:text-gray-100 h-[78.7vh] relative" x-data="chatApp">

                    {{-- Messages --}}
                    <div class="p-4 overflow-y-auto" x-ref="messageContainer" style="max-height: calc(78.7vh - 5rem);">
                        <template x-for="msg in messages" :key="msg.id">
                            <div class="mb-4 flex flex-col" :class="msg.user_id === {{ auth()->id() }} ? 'items-end' : 'items-start'">
                                <span class="text-xs" x-text="msg.user_name"></span>
                                <span class="bg-indigo-600 p-2 rounded-full w-fit h-fit" x-text="msg.message"></span>
                            </div>
                        </template>
                    </div>

                    {{-- Input and Send Button --}}
                    <div class="absolute bottom-6 w-full px-4">
                        <form @submit.prevent="sendMessage" class="relative">
                            <input type="text" name="message" id="message-input" x-model="newMessage" class="w-full rounded-full bg-gray-900 focus:outline-none" placeholder="Send a message . . .">
                            <button type="submit" class="absolute h-full top-0 right-0 px-4 py-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 focus:outline-none focus:bg-indigo-600">
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
