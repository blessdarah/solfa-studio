<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\PublishController;
use App\Http\Controllers\RehearsalController;
use App\Http\Controllers\ScoreArchiveController;
use App\Http\Controllers\ScoreController;
use App\Http\Controllers\ScoreManageController;
use App\Http\Controllers\ShareController;
use Illuminate\Support\Facades\Route;

// Public pages: anyone can find, read, practise and print published songs, no account needed.
Route::get('/', [PublicController::class, 'home'])->name('home');
Route::get('/songs', [PublicController::class, 'search'])->name('public.search');
Route::get('/p/{slug}', [PublicController::class, 'show'])->name('public.score');
Route::post('/p/{slug}/played', [PublicController::class, 'played'])
    ->middleware('throttle:30,1')
    ->name('public.played');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('login.store');

    Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('/register', [RegisteredUserController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('register.store');
});

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::post('/scores', [ScoreController::class, 'store'])->name('scores.store');
    Route::get('/scores/{score}', [ScoreController::class, 'show'])->name('scores.show');
    Route::put('/scores/{score}/document', [ScoreController::class, 'saveDocument'])->name('scores.document');
    Route::post('/scores/{score}/suggest', [ScoreController::class, 'suggest'])
        ->middleware('throttle:20,1')
        ->name('scores.suggest');

    Route::patch('/scores/{score}/details', [ScoreManageController::class, 'updateDetails'])->name('scores.details');
    Route::post('/scores/{score}/duplicate', [ScoreManageController::class, 'duplicate'])->name('scores.duplicate');
    Route::delete('/scores/{score}', [ScoreManageController::class, 'destroy'])->name('scores.destroy');
    Route::post('/scores/{score}/restore', [ScoreManageController::class, 'restore'])->withTrashed()->name('scores.restore');
    Route::delete('/scores/{score}/forever', [ScoreManageController::class, 'forceDestroy'])->withTrashed()->name('scores.forget');

    Route::post('/scores/{score}/publish', [PublishController::class, 'store'])->name('scores.publish');
    Route::patch('/scores/{score}/publish', [PublishController::class, 'update'])->name('scores.publish.options');
    Route::delete('/scores/{score}/publish', [PublishController::class, 'destroy'])->name('scores.unpublish');

    Route::post('/scores/{score}/archive', [ScoreArchiveController::class, 'store'])->name('scores.archive');
    Route::delete('/scores/{score}/archive', [ScoreArchiveController::class, 'destroy'])->name('scores.unarchive');

    Route::post('/scores/{score}/shares', [ShareController::class, 'store'])->name('shares.store');
    Route::get('/s/{token}', [ShareController::class, 'open'])->name('shares.open');

    Route::post('/collections', [CollectionController::class, 'store'])->name('collections.store');
    Route::post('/collections/{collection}/scores', [CollectionController::class, 'attach'])->name('collections.attach');
    Route::delete('/collections/{collection}/scores/{score}', [CollectionController::class, 'detach'])->name('collections.detach');

    Route::post('/rehearsals', [RehearsalController::class, 'store'])->name('rehearsals.store');

    Route::post('/notifications/read', [NotificationController::class, 'read'])->name('notifications.read');
});
