<?php

use App\Events\MessageSent;
use App\Http\Controllers\CallController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});


Route::middleware('auth')->group(function () {

    Route::middleware('verified')->group(function () {
        // ========== Dashboard ==========
        Route::get('/dashboard', function () {
            return view('dashboard');
        })->name('dashboard');

        // ========== Chat ==========
        Route::get('/chat', [ChatController::class, 'index'])->name('chat');
        Route::post('/chat', [ChatController::class, 'store'])->name('chat.store');

        // ========== Dashboard ==========
        Route::get('/call', [CallController::class, 'index'])->name('call');
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
