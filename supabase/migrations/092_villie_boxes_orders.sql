-- 092_villie_boxes_orders.sql
-- Villie Boxes — curated-commerce order tables.
--
-- First in-app PHYSICAL-GOODS payment surface. Until now the only in-app
-- Stripe charge was V1 Specialist booking; Milk + Gear are cash-only. Boxes
-- are first-party retail sold BY Villie (not a P2P marketplace), so this is a
-- straightforward merchant charge — no money-transmitter exposure, no Connect.
--
-- The catalog itself is hardcoded in app + edge-function code for the first
-- release (see apps/mobile/src/api/boxes.ts). These tables persist the ORDER:
-- the lines the user bought (box id + which optional items they removed +
-- which add-ons they chose), the server-recomputed amounts, the Stripe
-- PaymentIntent id, and a shipping address. Pricing is ALWAYS recomputed
-- server-side in boxes-create-payment-intent — client amounts are advisory.
--
-- RLS: a user can read their own orders + items. All WRITES go through the
-- edge function with the service role (which bypasses RLS), so there are no
-- INSERT/UPDATE policies for authenticated — a client cannot forge a "paid"
-- order or tamper with amounts.

create table if not exists public.villie_box_orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  status                   text not null default 'pending_payment'
                             check (status in ('pending_payment','paid','fulfilled','cancelled','refunded')),
  is_bundle                boolean not null default false,
  -- subtotal = goods only; amount = what we charge (shipping/tax added later).
  subtotal_cents           integer not null check (subtotal_cents >= 0),
  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text    not null default 'usd',
  stripe_payment_intent_id text,
  -- shipping snapshot (denormalized on purpose — an order is an immutable record)
  ship_name                text,
  ship_line1               text,
  ship_line2               text,
  ship_city                text,
  ship_state               text,
  ship_zip                 text,
  ship_phone               text,
  created_at               timestamptz not null default now(),
  paid_at                  timestamptz
);

create table if not exists public.villie_box_order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.villie_box_orders(id) on delete cascade,
  -- 'delivery' | 'newborn' | 'mama' (validated against the code catalog by the
  -- edge function; left as free text here so a catalog change needs no migration).
  box_id            text not null,
  removed_indices   integer[] not null default '{}',
  addon_indices     integer[] not null default '{}',
  line_amount_cents integer not null check (line_amount_cents >= 0),
  created_at        timestamptz not null default now()
);

create index if not exists idx_villie_box_orders_user
  on public.villie_box_orders (user_id, created_at desc);
create index if not exists idx_villie_box_order_items_order
  on public.villie_box_order_items (order_id);

alter table public.villie_box_orders      enable row level security;
alter table public.villie_box_order_items enable row level security;

-- Owner can read their own orders. No write policies → only the service role
-- (edge function) can insert/update, which is the whole security model here.
drop policy if exists villie_box_orders_select_own on public.villie_box_orders;
create policy villie_box_orders_select_own
  on public.villie_box_orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists villie_box_order_items_select_own on public.villie_box_order_items;
create policy villie_box_order_items_select_own
  on public.villie_box_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.villie_box_orders o
      where o.id = villie_box_order_items.order_id
        and o.user_id = auth.uid()
    )
  );
