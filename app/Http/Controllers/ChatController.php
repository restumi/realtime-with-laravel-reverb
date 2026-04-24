<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\PublicMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    public function index()
    {
        $messages = PublicMessage::with('user')
            ->oldest()
            ->get()
            ->map(fn($m) => [
                'id'         => $m->id,
                'user_id'    => $m->user_id,
                'user_name'  => $m->user->name ?? 'User',
                'message'    => $m->message,
                'created_at' => $m->created_at->diffForHumans(),
            ]);

        return view('chat', compact('messages'));
    }

    public function store(Request $request)
    {
        try {
            $request->validate([
                'message' => 'required|string|max:1000'
            ]);

            $message = PublicMessage::create([
                'user_id' => auth()->id(),
                'message' => $request->message
            ]);

            $message->load('user');

            MessageSent::dispatch($message);

            return response()->json([
                'id' => $message->id,
                'user_id' => $message->user_id,
                'user_name' => $message->user->name,
                'message' => $message->message,
                'created_at' => $message->created_at->diffForHumans()
            ], 201);
        }

        catch (\Exception $e) {
            Log::error($e);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
