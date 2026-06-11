# Milk Donor Social Links — Privacy Policy section + Risk review memo

**Status:** DRAFT for counsel review. Not legal advice. Prepared 2026-06-10 from the
shipped implementation (migration 075, `DonorSocialLinksScreen`, `DonorProfileScreen`).
**Owner:** Felipe. **Gate:** must clear before milk-hub launch to real users.

---

## 1. What the feature is (factual basis)

V2 Milk Connect lets a **donor** optionally add links to their own social profiles —
Instagram, TikTok, Facebook, and/or a personal website — which then display on their
public **Donor Profile** as informal "social proof."

Key implementation facts (so the policy/memo match reality):

- **Opt-in.** Donors add links themselves via `DonorSocialLinksScreen`; nothing is
  collected or shown unless the donor enters it.
- **Donor-provided, self-attested.** The links are typed by the donor. We do **not**
  verify ownership, authenticity, or content. No OAuth, no API connection, no scraping
  of the linked accounts.
- **Public surface.** Once added, links are visible to any signed-in user viewing that
  donor's profile (recipients browsing donors).
- **No data pulled back.** We store only the URLs/handles the donor enters. We do not
  read followers, posts, or any data from the linked platforms.
- **Disclaimers already in-app** on both the donor entry screen and the recipient-facing
  profile, stating the links are donor-provided and unverified.
- **Storage:** `milk_donors` social-link columns (migration 075), RLS owner-write /
  public-read consistent with the rest of the donor profile.

---

## 2. Privacy Policy — draft section to insert

> ### Donor social links
> If you create a milk donor profile, you may **choose** to add links to your own
> social media accounts (such as Instagram, TikTok, or Facebook) or a personal website.
> Providing these links is entirely optional.
>
> If you add them, those links are shown on your **public donor profile** and are visible
> to other users of the milk-sharing feature. You can edit or remove them at any time from
> your donor profile settings; removing a link removes it from your profile going forward.
>
> The Village does **not** verify, monitor, or control the accounts or websites you link to,
> and does not access any information from them — we store only the link you provide.
> Please only add links you are comfortable sharing publicly, and do not include links that
> reveal information you wish to keep private. Information you make public through these links
> is governed by the privacy practices of those third-party platforms, not by The Village.

*(Cross-reference: add "social media links you choose to provide" to the "Information you
provide to us" enumeration, and confirm the data-sharing / third-party-services sections
acknowledge that linked content lives off-platform.)*

---

## 3. Risk review memo (for counsel)

**3.1 New public PII surface.** This is the first feature that publishes a user's
off-platform identity (social handles → real-world identity) to other users. Donors are
often new mothers; linking IG/TikTok can de-anonymize them and their infant to strangers
arranging an in-person milk handoff. The in-app disclaimer + opt-in posture is the current
mitigation. **Question for counsel:** is an opt-in + unverified disclaimer sufficient, or do
we need an explicit acknowledgement at the point of entry ("these links are public to anyone
browsing donors")?

**3.2 Verification / misrepresentation.** Because links are self-attested and unverified, a
donor (or impersonator) could link an account that isn't theirs, or one with off-brand
content. Mitigations to confirm with counsel: (a) the unverified disclaimer; (b) reporting +
takedown path (does the existing gear/milk report flow cover donor-profile links? — confirm);
(c) Terms language disclaiming responsibility for linked third-party content (Section 230-shaped).

**3.3 Minor safety / contact.** Social links create an off-platform contact channel that
bypasses in-app safety framing (the SafeMilkHandoffModal, cash-only posture). Confirm whether
any added guidance is warranted near the links ("arrange handoffs through the app's safety
guidance, not DMs").

**3.4 Content moderation exposure.** We display user-provided URLs. Confirm the Terms +
acceptable-use policy prohibit linking to illegal/harmful content and that we retain the right
to remove links, consistent with the gear takedown posture.

**3.5 Data deletion.** On account delete (A2.c, currently behind a flag), confirm social links
are included in the PII scrub. Today removal is manual via the profile; deletion-cascade rules
are still attorney-gated — flag links for inclusion when that lands.

---

## 4. Open items before launch
- [ ] Counsel approves the Privacy Policy section above (or edits).
- [ ] Confirm reporting/takedown path covers donor social links.
- [ ] Terms: third-party-link disclaimer + right-to-remove.
- [ ] Decide on a point-of-entry "this is public" acknowledgement.
- [ ] Include social links in the account-deletion PII scrub (when A2.c cascade ships).
