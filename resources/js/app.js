import './echo';

import Alpine from 'alpinejs';
import { initChatApp } from './chat';
import { initCallApp } from './call';

window.Alpine = Alpine;

document.addEventListener('alpine:init', () => {
    if (document.querySelector('[x-data="chatApp"]')) {
        initChatApp();
    }
    if (document.querySelector('[x-data="callApp"]')) {
        initCallApp();
    }
});

Alpine.start();
