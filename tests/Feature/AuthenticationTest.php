<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_root_is_the_public_home_page(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('public/home')->where('signed_in', false));
    }

    public function test_the_login_screen_can_be_rendered(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('auth/login'));
    }

    public function test_guests_are_sent_to_the_login_screen(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_a_composer_can_sign_in_with_their_email(): void
    {
        $user = User::factory()->create([
            'email' => 'bless@example.com',
        ]);

        $response = $this->post('/login', [
            'identifier' => 'BLESS@example.com',
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
    }

    public function test_a_composer_can_sign_in_with_their_phone(): void
    {
        $user = User::factory()->create([
            'email' => null,
            'phone' => '+233241234567',
        ]);

        $response = $this->post('/login', [
            'identifier' => '+233 24 123 4567',
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_credentials_are_rejected(): void
    {
        User::factory()->create(['email' => 'bless@example.com']);

        $response = $this->from('/login')->post('/login', [
            'identifier' => 'bless@example.com',
            'password' => 'not-the-password',
        ]);

        $response->assertRedirect('/login');
        $response->assertSessionHasErrors('identifier');
        $this->assertGuest();
    }

    public function test_a_composer_can_register_with_an_email(): void
    {
        $response = $this->post('/register', [
            'name' => 'Blessdaraah',
            'identifier' => 'Bless@Example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        $this->assertDatabaseHas('users', [
            'name' => 'Blessdaraah',
            'email' => 'bless@example.com',
            'phone' => null,
        ]);
    }

    public function test_a_composer_can_register_with_a_phone(): void
    {
        $this->post('/register', [
            'name' => 'Ama Serwaa',
            'identifier' => '+233 24 123 4567',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect('/dashboard');

        $this->assertDatabaseHas('users', [
            'name' => 'Ama Serwaa',
            'email' => null,
            'phone' => '+233241234567',
        ]);
    }

    public function test_an_email_cannot_be_registered_twice(): void
    {
        User::factory()->create(['email' => 'bless@example.com']);

        $response = $this->from('/register')->post('/register', [
            'name' => 'Someone Else',
            'identifier' => 'bless@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertRedirect('/register');
        $response->assertSessionHasErrors('identifier');
        $this->assertGuest();
    }

    public function test_a_phone_number_must_look_like_a_phone_number(): void
    {
        $response = $this->from('/register')->post('/register', [
            'name' => 'Someone Else',
            'identifier' => 'not-a-phone',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertRedirect('/register');
        $response->assertSessionHasErrors('identifier');
    }

    public function test_a_signed_in_composer_is_sent_away_from_the_login_screen(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/login')
            ->assertRedirect('/dashboard');
    }

    public function test_a_composer_can_sign_out(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/logout')
            ->assertRedirect('/login');

        $this->assertGuest();
    }
}
