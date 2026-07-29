# Billy Capability Map

Source of truth for "can Billy do everything?". A capability is DONE when `wired = yes`
and its eval in docs/BILLY_EVALS.md is green. Tier rules: see
docs/superpowers/specs/2026-07-22-billy-capability-coverage-design.md.

Tier values: `read` = pure read/search, `do` = reversible low-stakes write (Billy acts),
`route` = sensitive/irreversible — Billy deep-links + native confirm, `blocked` = never automate.
`confirm?` is Y for every `route` row (and every `blocked` row is never executed at all), N otherwise.
`wired?` states: `yes` = live in production AND its eval is green; `code` = built on
branch `feat/billy-capability-coverage`, pending `supabase functions deploy` + eval run;
`no` = not built yet. The 6 shipped read tools are `yes`; Wave 1 (log-a-nap/bottle/diaper
via the `log_baby_event` tool, and 6 route deep-links via the generic `navigate` tool) is `code`.

| action | tier | backing RPC / edge fn | confirm? | wired? | eval id |
|--------|------|-----------------------|----------|--------|---------|
| Find specialists nearby | read | rpc:specialists_near | N | yes | E-find-specialists |
| Search gear listings nearby | read | rpc:list_gear_near | N | yes | E-search-gear |
| Find milk donors nearby | read | rpc:search_donors_near | N | yes | E-find-donors |
| Find events nearby | read | rpc:list_events_near | N | yes | E-find-events |
| Find daycares nearby | read | fn:daycares-nearby | N | yes | E-find-daycares |
| Read my baby tracking stats | read | (client) baby_sleep/feed/diaper_logs aggregate | N | yes | E-read-tracking-stats |
| Log a nap / start sleep timer | do | insert:baby_sleep_logs | N | yes | E-start-sleep |
| Stop / end a sleep timer | do | update:baby_sleep_logs | N | no | E-stop-sleep |
| Log a nursing session / start feed timer | do | insert:baby_feed_logs | N | no | E-start-feed |
| Stop / end a feed timer | do | update:baby_feed_logs | N | no | E-stop-feed |
| Log a bottle feed | do | insert:baby_feed_logs | N | yes | E-log-bottle |
| Log a diaper change | do | insert:baby_diaper_logs | N | yes | E-log-diaper |
| Remember a fact from conversation (Billy's brain) | do | insert:villie_memories (mig 109) | N | code | E-remember-fact |
| Jot a freeform baby note | do | insert:baby_log_notes | N | no | E-log-note |
| Parse a voice/text jot into structured logs | do | fn:playbook-parse-note | N | no | E-parse-note |
| Read today's logs (feeds/naps/diapers) | read | (client) baby_sleep/feed/diaper_logs | N | no | E-read-today-logs |
| Read active sleep/feed timer | read | (client) baby_sleep/feed_logs | N | no | E-read-active-timer |
| Set up / edit my baby profile (DOB, gender, feeding) | do | upsert:baby_profiles | N | no | E-upsert-baby-profile |
| Set my Playbook preferences | do | update:baby_profiles | N | no | E-baby-playbook-prefs |
| Read my current milestone | read | rpc:get_my_current_milestone | N | no | E-read-current-milestone |
| Read milestones for a given week | read | rpc:get_milestones_for_week | N | no | E-read-week-milestones |
| Read my notifications feed | read | (client) user_notifications_feed | N | no | E-read-notifications |
| Mark a notification read | do | update:user_notifications_feed | N | no | E-mark-notification-read |
| Read today's check-in | read | rpc:get_today_checkin | N | no | E-read-today-checkin |
| Read my recent mood check-ins | read | (client) daily_checkins | N | no | E-read-recent-checkins |
| Submit a daily mood/energy check-in | do | rpc:upsert_daily_checkin + fn:ai-daily-checkin | N | no | E-submit-checkin |
| Read my Home feed | read | rpc:get_home_feed | N | no | E-read-home-feed |
| Refresh my Home feed | do | fn:home-feed-curator | N | no | E-refresh-home-feed |
| Read this week's Manual videos/pieces | read | rpc:list_this_week_manual | N | no | E-read-this-week-manual |
| Browse Manual video library | read | rpc:list_manual_videos | N | no | E-list-manual-videos |
| Read Manual pieces (stories/checklists/infographics) | read | rpc:list_manual_pieces | N | no | E-list-manual-pieces |
| Read a single Manual video + week intro | read | rpc:get_week_intro_video / list_manual_videos | N | no | E-get-manual-video |
| Mark a Manual video watched | do | rpc:mark_video_watched | N | no | E-mark-video-watched |
| Save / unsave a Manual video | do | rpc:toggle_manual_save | N | no | E-toggle-manual-save |
| Read my saved Manual videos | read | rpc:list_my_saved_manual | N | no | E-list-saved-manual |
| Log a Manual video share | do | rpc:log_manual_share | N | no | E-log-manual-share |
| Read the weekly journey for a week | read | rpc:get_weekly_journey | N | no | E-read-weekly-journey |
| Check off a weekly-journey checklist item | do | insert:user_week_checklist_completions | N | no | E-check-journey-item |
| Uncheck a weekly-journey checklist item | do | delete:user_week_checklist_completions | N | no | E-uncheck-journey-item |
| Read Villie Picks (curated products) | read | (client) villie_picks | N | no | E-read-picks |
| Read my unified Saved dashboard | read | rpc:get_saved_dashboard | N | no | E-read-saved-dashboard |
| Read a specialist profile | read | (client) specialists | N | no | E-read-specialist |
| Read a specialist's reviews | read | (client) reviews | N | no | E-read-specialist-reviews |
| Read my saved specialists | read | (client) favorites | N | no | E-read-saved-specialists |
| Save / unsave (favorite) a specialist | do | insert/delete:favorites | N | no | E-toggle-favorite-specialist |
| Write a specialist review | route | insert:reviews | Y | no | E-write-specialist-review |
| AI-match me to best-fit specialists | read | fn:ai-match | N | no | E-ai-match-specialists |
| Ask AI a question about a specialist | read | fn:ai-profile-qa | N | no | E-ai-profile-qa |
| Generate questions to ask at an appointment | read | fn:ai-followup-questions | N | no | E-ai-followup-questions |
| Translate a specialist profile field | do | fn:ai-translate | N | no | E-ai-translate |
| Refresh a specialist's AI review summary | do | fn:ai-review-summary | N | no | E-ai-review-summary |
| Book an appointment with a specialist | route | fn:create-payment-intent + insert:appointments | Y | code | E-book-appointment |
| Read my appointments | read | (client) appointments | N | no | E-read-appointments |
| Message a specialist (send DM) | route | insert:messages | Y | no | E-message-specialist |
| Read my specialist message thread | read | (client) messages | N | no | E-read-specialist-thread |
| Read a milk donor profile | read | (client) milk_donor_profiles | N | no | E-read-donor-profile |
| Read a donor's active listing | read | (client) milk_listings | N | no | E-read-donor-listing |
| Read my saved donors | read | (client) milk_saved_donors | N | no | E-read-saved-donors |
| Save / unsave a milk donor | do | insert/delete:milk_saved_donors | N | no | E-toggle-save-donor |
| AI-match me to best-fit donors | read | fn:milk-match-donors | N | no | E-milk-match-donors |
| Ask AI a question about a donor | read | fn:milk-donor-qa | N | no | E-milk-donor-qa |
| Become a milk donor (create donor profile) | route | insert:milk_donor_profiles | Y | code | E-create-donor-profile |
| Edit my donor profile | route | update:milk_donor_profiles | Y | code | E-update-donor-profile |
| Save donor questionnaire responses | route | upsert:milk_questionnaire_responses | Y | no | E-donor-questionnaire |
| Set my donor diet flags | route | upsert:milk_donor_diet_flags | Y | no | E-donor-diet-flags |
| Add a donor medication (trust badge) | route | insert:milk_donor_medications | Y | no | E-donor-add-med |
| Remove a donor medication | route | delete:milk_donor_medications | Y | no | E-donor-remove-med |
| Create a milk listing | route | insert:milk_listings | Y | no | E-create-milk-listing |
| Run the donor safety screener (AI self-check) | do | fn:milk-safety-screener | N | no | E-milk-safety-screener |
| Run the donor questionnaire coach (AI) | do | fn:milk-questionnaire-coach | N | no | E-milk-questionnaire-coach |
| Generate my donor trust narrative (AI) | do | fn:milk-trust-narrative | N | no | E-milk-trust-narrative |
| Open / start a milk message thread | do | insert:milk_message_threads | N | no | E-milk-open-thread |
| Send a milk message (DM) | route | insert:milk_messages | Y | no | E-send-milk-message |
| Mark a milk thread read | do | rpc:mark_thread_read | N | no | E-mark-milk-thread-read |
| Read my milk message threads | read | rpc:list_my_milk_threads | N | no | E-read-milk-threads |
| Record milk legal-disclosure acceptance | route | insert:milk_legal_acceptances | Y | no | E-milk-legal-accept |
| Read my Milk Vault settings | read | (client) milk_vault_settings | N | no | E-read-vault-settings |
| Choose Milk Vault mode (keep vs sell/donate) | do | update:milk_vault_settings | N | no | E-vault-choose-mode |
| Update Milk Vault settings | do | update:milk_vault_settings | N | no | E-vault-update-settings |
| List my Milk Vault bags | read | (client) milk_vault_bags | N | no | E-read-vault-bags |
| Add a Milk Vault bag | do | insert:milk_vault_bags | N | no | E-vault-add-bag |
| Update a Milk Vault bag | do | update:milk_vault_bags | N | no | E-vault-update-bag |
| Delete a Milk Vault bag | do | delete:milk_vault_bags | N | no | E-vault-delete-bag |
| Record a bag outcome (used/donated/sold) | do | insert:milk_vault_transactions | N | no | E-vault-bag-outcome |
| Scan a milk bag photo to prefill (AI) | do | fn:milk-vault-scan | N | no | E-vault-scan-bag |
| Read my Milk Vault transactions | read | (client) milk_vault_transactions | N | no | E-read-vault-transactions |
| List my Milk Vault sell/donate listings | read | (client) milk_vault_listings | N | no | E-read-vault-listings |
| Create a Milk Vault sell/donate listing | route | insert:milk_vault_listings | Y | no | E-vault-create-listing |
| Update a Milk Vault listing status | route | update:milk_vault_listings | Y | no | E-vault-update-listing |
| Configure a Milk Vault shipping kit | route | upsert:milk_vault_shipping_kits | Y | no | E-vault-shipping-kit |
| Read a gear listing detail | read | rpc:get_gear_listing | N | no | E-read-gear-listing |
| Read my gear listings | read | rpc:list_my_gear_listings | N | no | E-read-my-gear-listings |
| Read my saved gear | read | rpc:list_my_saved_gear | N | no | E-read-saved-gear |
| Save / unsave a gear listing | do | insert/delete:gear_saved_listings | N | no | E-toggle-save-gear |
| Create a gear listing | route | rpc:create_gear_listing + insert:gear_listing_images | Y | code | E-create-gear-listing |
| Change a gear listing status (sold/withdraw/reactivate) | route | rpc:update_gear_status (updateStatus) | Y | no | E-update-gear-status |
| UPC-lookup to prefill a gear listing | do | fn:gear-upc-lookup | N | no | E-gear-upc-lookup |
| Identify gear from a photo (AI) | do | fn:gear-vision-identify | N | no | E-gear-vision-identify |
| CPSC recall check on a gear item | do | fn:gear-cpsc-check | N | no | E-gear-cpsc-check |
| Suggest a fair price for gear (AI) | do | fn:gear-price-suggest | N | no | E-gear-price-suggest |
| Open / start a gear message thread | do | rpc:get_or_create_gear_thread | N | no | E-gear-open-thread |
| Send a gear message (DM to seller) | route | insert:gear_messages | Y | no | E-send-gear-message |
| Mark a gear thread read | do | rpc:mark_gear_thread_read | N | no | E-mark-gear-thread-read |
| Read my gear message threads | read | rpc:list_my_gear_threads | N | no | E-read-gear-threads |
| Acknowledge the safe-meeting guide | do | rpc:ack_gear_safe_meeting | N | no | E-gear-ack-safe-meeting |
| Report a gear listing | route | insert:gear_listing_reports | Y | no | E-report-gear-listing |
| Record gear legal-addendum acceptance | route | insert:gear_legal_acceptances | Y | no | E-gear-legal-accept |
| Activate a paid gear boost (IAP payment) | route | fn:gear-boost-activate | Y | code | E-gear-boost |
| RSVP to an event | do | insert:event_rsvps | N | no | E-event-rsvp |
| Cancel an event RSVP | do | update:event_rsvps | N | no | E-event-cancel-rsvp |
| Mark an event added to calendar | do | update:event_rsvps | N | no | E-event-calendar-added |
| Save / unsave an event | do | insert/delete:event_saves | N | no | E-toggle-save-event |
| Read my event RSVPs | read | rpc:list_my_rsvps | N | no | E-read-my-rsvps |
| Read my saved events | read | rpc:list_my_saved_events | N | no | E-read-saved-events |
| Read a single event | read | (client) events | N | no | E-read-event |
| Browse perks for my stage | read | rpc:list_perks | N | no | E-list-perks |
| Read a perk detail | read | rpc:get_perk (getPerk) | N | no | E-read-perk |
| Claim a perk (reveal code / affiliate link) | do | rpc:claim_perk | N | no | E-claim-perk |
| Read my claimed perks | read | rpc:list_my_claims | N | no | E-read-my-claims |
| Buy a curated Villie Box (checkout) | route | fn:boxes-create-payment-intent | Y | code | E-buy-box |
| Read my box orders | read | (client) villie_box_orders | N | no | E-read-box-orders |
| Discover community rooms | read | rpc:list_rooms_for_discovery | N | no | E-list-rooms |
| Read a room + pinned resources | read | rpc:get_room_by_slug / list_pinned_resources | N | no | E-read-room |
| Read room messages | read | rpc:list_room_messages | N | no | E-read-room-messages |
| Join a community room | do | rpc:join_room | N | no | E-join-room |
| Leave a community room | do | rpc:leave_room | N | no | E-leave-room |
| Post a community message | route | insert:room_messages | Y | no | E-post-room-message |
| React / un-react to a room message | do | insert/delete:room_message_reactions | N | no | E-toggle-room-reaction |
| Mark a room read | do | rpc:mark_room_read | N | no | E-mark-room-read |
| Get / dismiss a room icebreaker | do | rpc:get_icebreaker / dismiss_icebreaker | N | no | E-room-icebreaker |
| Generate a room icebreaker (AI) | do | fn:room-icebreaker | N | no | E-generate-icebreaker |
| Summon the @village AI companion in a room | do | fn:room-ai-companion | N | no | E-room-ai-companion |
| Read my room match suggestion | read | rpc:get_my_room_match | N | no | E-read-room-match |
| Refresh my room match (AI) | do | fn:room-auto-match | N | no | E-refresh-room-match |
| Read a room's weekly summary | read | (client) room_weekly_summaries | N | no | E-read-room-summary |
| Generate an anonymous room alias | do | fn:room-alias-generate | N | no | E-anon-alias |
| Read my anonymous identities | read | rpc:list_my_anon_identities / get_my_anon_identity | N | no | E-read-anon-identities |
| Set anonymous-mode default | do | rpc:set_anonymous_mode_default | N | no | E-set-anon-default |
| Draft a caregiver day sheet (from logs) | do | (client) draftScheduleFromLogs | N | no | E-draft-day-sheet |
| Create / save a day sheet | do | insert:day_sheets | N | no | E-create-day-sheet |
| Update a day sheet | do | update:day_sheets | N | no | E-update-day-sheet |
| Delete a day sheet (revoke public share) | do | delete:day_sheets | N | no | E-delete-day-sheet |
| Upload a day-sheet tip photo | do | (storage) day-sheets bucket | N | no | E-day-sheet-photo |
| Read my day sheets | read | (client) day_sheets | N | no | E-read-day-sheets |
| Edit my profile (name/stage/ZIP/insurance/due date) | do | update:users | N | no | E-edit-profile |
| Set my search radius preference | do | update:users (search_radius_miles) | N | no | E-set-radius |
| Set my notification toggles / quiet hours | do | update:users (notif_prefs) | N | no | E-set-notif-prefs |
| Set my app language (EN/ES) | do | update:users (preferred_language) | N | no | E-set-language |
| Change my email | blocked | supabase.auth.updateUser({email}) | — | no | E-change-email |
| Change my password | blocked | supabase.auth.updateUser({password}) | — | no | E-change-password |
| Delete my account | blocked | fn:account-delete | — | no | E-delete-account |
| Triage a medical/emergency concern | blocked | fn:ai-triage (stays deterministic) | — | no | E-ai-triage |

## Not exposed to Billy

Intentionally excluded — never surfaced as a Billy tool.

- **`appHelp.ts` (`sendMessage`, `fetchUserContext`)** — this *is* Billy's own chat surface (`app-help-chat`); it is the caller, not a callable tool.
- **`agents.ts` (`agentsApi` via `agents-health` / `agents-triage` / `agents-run`)** — internal agent-runtime bridge; hard constraint that no public user flow calls agents and outputs never mutate DB state.
- **`clinical-review.ts` (`listPending`, `approve`, `reject` → `list_pending_review` / `approve_content_row` / `reject_content_row`)** — clinical-reviewer admin tooling, gated by `is_clinical_reviewer()`.
- **`event-review.ts` (`listPending`, `approve`, `reject` → `list_pending_events` / `approve_event` / `reject_event`)** — event-moderation admin tooling.
- **`community.ts` moderator RPCs (`isModeratorAnywhere`, `listOpenCrisisFlags` → `list_open_crisis_flags_for_moderator`, `resolveCrisisFlag`)** — moderator-only; crisis handling stays deterministic + human.
- **`specialists.ts` `issueSpecialistInvite` (`admin-specialist-invite`)** — admin/service-role specialist onboarding, not a mom action.
- **`gear.ts` `logGearEvent` (insert:`gear_analytics_events`)** — internal compliance/analytics instrumentation, fired implicitly by other actions, never user-invoked.
- **Server-only / cron / webhook edge fns** — `home-feed-curator` (batch mode), `ai-milestone-explainer`, `ai-perk-recommender`, `ai-event-relevance`, `ai-gear-tip`, `refresh-stale-summaries`, `room-weekly-summary`, `room-message-scan`, `gear-cpsc-recall-sync`, `gear-moderation-*`, `gear-takedown-template-dispatch`, `events-ingest-ics`, `events-geocode`, `ai-event-screen`, `ai-weekly-journey-fill`, `appointment-reminder`, `push-notify`, `twilio-sms`, `calendly-webhook`, `stripe-webhook`, `resend-webhook`, `perks-redemption-webhook`, `perks-build-deeplink`, `villie-weekly-digest`, `daily-checkin-reminder`, `npi-verify`, `admin-approve-specialist`, `admin-compliance-events`, `auth-google-exchange`, `specialist-invite-create`, `specialist-invite-accept`, `manual-og`, `day-sheet-page`, `gear-cpsc-recall-sync`, `room-weekly-summary`, `agents-*` — invoked by cron, triggers, webhooks, or admin surfaces, never by a mom in-session.
- **Pure client helpers / formatters** — `formatPrice`, `categoryLabel`, `formatAge`, `computeWeekNumber`, `minutesToLabel`, `deriveKeyTimes`, `shareUrl`, `manualVideoShareUrl`, `muxStreamUrl`, `socialUrl`, `isListingBoosted`, `boostRemainingLabel`, `parseCtaTarget`, label/`*Label` functions, etc. — no side effects, not capabilities.
