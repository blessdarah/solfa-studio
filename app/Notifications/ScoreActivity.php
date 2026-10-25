<?php

namespace App\Notifications;

use App\Models\Score;
use App\Models\User;
use App\Support\ScoreSummary;
use Illuminate\Notifications\Notification;

/**
 * Someone else did something to one of your scores: opened its share
 * link, or saved a change through an "edit" link. Lights the bell.
 */
class ScoreActivity extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly Score $score,
        public readonly string $action,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{actor: string, initials: string, action: string, score_id: string, score_title: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'actor' => $this->actor->name,
            'initials' => ScoreSummary::initials($this->actor->name),
            'action' => $this->action,
            'score_id' => $this->score->id,
            'score_title' => $this->score->title,
        ];
    }
}
